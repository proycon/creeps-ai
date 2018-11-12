/*jshint esnext: true */

const PARAMETERS = {
    MAXDECAY: 0.2,
    MINRESERVE: 0.25, //minimum energy reserve
    DEBUG: true,
};

function planscene() {
    //init
    if (!Memory.allocation) {
       Memory.allocation = {};
    }
    var scene = {
        totalenergy: 0,
        totalcapacity: 0,
        harvesters: 0,
        upgraders: 0,
        builders: 0,
        repairer: 0,
        idler: 0,
        hostiles: [],
        hitsMax: 10000, //TODO: determine dynamically
        targets: {}
    };

    //iterate over rooms (single room only for now)
    _.forEach(Game.rooms, room => {
        scene.totalenergy += room.energyAvailable;
        scene.totalcapacity += room.energyCapacityAvailable;
        scene.creeps = room.find(FIND_MY_CREEPS);
        scene.hostiles = room.find(FIND_HOSTILE_CREEPS);
        scene.towers =  room.find(FIND_MY_STRUCTURES, { filter: structure => structure.structureType == STRUCTURE_TOWER });
        scene.creeps.forEach(creep => {
            if (!creep.memory.role) creep.memory.role = "idle";
            scene[creep.memory.role + 's']++;
        });
        scene.targets = {
            harvester: room.find(FIND_SOURCES_ACTIVE),
            builder: room.find(FIND_MY_CONSTRUCTION_SITES),
            upgrader: room.controller,
            carrier: room.find(FIND_MY_STRUCTURES, { filter: structure => {
                return ((structure.energyCapacity) && (structure.energy < structure.energyCapacity));
            }}),
            repairer: room.find(FIND_MY_STRUCTURES, { filter: structure => {
                    return (structure.hitsMax) && (structure.hits < scene.hitsMax) && (structure.hits < (1- PARAMETERS.MAXDECAY) * structure.hitsMax);
            }}),
            attacker: scene.hostiles
        };
    });
    return scene;
}



function commission(creep, scene) {
    // commissions a creep to a target
    var target = null;
    if (creep.memory.target) {
        //we already have a target, set a new one
        target = Game.getObjectById(creep.memory.target);
        decommission(null, target);
        target = null;
    }
    var potentialtargets = scene.targets[creep.memory.role];
    if (potentialtargets.length == 1) {
        //easy, only one target
        target = potentialtargets[0];
    } else if (potentialtargets.length > 1) {
        for (var key in _.sortBy(potentialtargets, t => creep.pos.getRangeTo(t))) {
            target = potentialtargets[key];
            if (creep.memory.role == "harvester") {
                if (Memory.allocation[target.id] <= getaccessibility(target)) {
                    //allocation not full yet, good, we take this one
                    break;
                }
            } else {
                //closest one suffices
                break;
            }
        }
    } else {
        return null;
    }
    //commission to the target
    creep.memory.target = target.id;
    Memory.allocation[target] += 1;
    return target;
}

function run(creep, scene) {
    var target;
    if (creep.memory.role == "idle") {
        creep.memory.role = newrole(creep, scene);
        if (PARAMETERS.DEBUG) {
            console.log("Worker " + creep.name + " assumed role " + creep.memory.role);
            creep.say(creep.memory.role);
        }
    }
    if (creep.memory.role != "idle") {
        if (!creep.memory.target) {
            target = commission(creep, scene);
        } else {
            target = Game.getObjectById(creep.memory.target);
        }
        if (!target) {
            //we couldn't find a target, become idle
            console.log("Worker " + creep.name + " (" + creep.memory.role + ") can't find a target");
            creep.say("no target");
            creep.memory.role = "idle";
            return false;
        }
        if (creep.memory.role == "harvester") {
            harvester(creep, target, scene);
        } else if (creep.memory.role == "carrier") {
            carrier(creep, target, scene);
        } else if (creep.memory.role == "repairer") {
            console.log("TODO: implement repairer!")
        } else if (creep.memory.role == "builder") {
            console.log("TODO: implement builder!")
        }
        return true;
    }
}

function newrole(creep, scene) {
    //assign a role for this creep
    if ((creep.carry) && (creep.carry.energy > 0)) {
        //we have energy to do something
        if ((scene.totalenergy < PARAMETERS.MINRESERVE * scene.totalcapacity) || (scene.totalenergy < 300)) {
            //not enough reserves, carry for storage
            return "carrier";
        } else if (scene.upgraders < 1) {
            //we have no upgrade
            return "upgrader";
        } else if ((scene.targets.repairer) && (scene.targets.repairer.length > 0)) {
            return "repairer";
        } else if ((scene.targets.builder) && (scene.targets.builder.length > 0)) {
            return "builder";
        } else {
            //nothing else to do? let's upgrade!
            return "upgrader";
        }
    } else {
        //we need energy for whatever we intend to do
        return "harvester";
    }
}

function spawnblueprint(scene) {
    if ((scene.totalenergy > PARAMETERS.MINRESERVE * scene.totalcapacity) || (scene.totalEnergy == scene.totalcapacity)) {
        if (scene.totalcapacity > 600) {
            return  [WORK, CARRY,CARRY,MOVE,MOVE];
        } else {
            return [WORK, CARRY, MOVE];
        }
    }
    return [];
}

function harvester(creep, target, scene) {
    var result = creep.harvest(target);
    if (result == OK) {
        decommission(creep, target);
    } else if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
    }
}

function carrier(creep, target, scene) {
    var result = creep.transfer(target, RESOURCE_ENERGY);
    if (result == OK)  {
        decommission(creep, target);
    } else if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(source, {visualizePathStyle: {stroke: '#0000aa'}});
    } else if (result == ERR_FULL) {
        //find a new target
        commission(creep, scene);
    } else {
        console.log("Unexpected result for carrier: " + result);
    }
    if (creep.carry.energy === 0) {
        decommission(creep,target);
    }
}

function decommission(creep, target) {
    if (creep) {
        creep.role = "idle";
        creep.memory.target = null;
    }
    if (target) {
        Memory.allocation[target.id] -= 1;
    }
}

function cleanup() {
    //Garbage collection
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            if (Memory.creeps[name].target) {
                Memory.allocation[Memory.creeps[name].target] -= 1;
            }
            delete Memory.creeps[name];
        }
    }
    for(var obj in Memory.incoming) {
        if(!Game.getObjectById[obj]) {
            delete Memory.incoming[obj];
        }
    }
    for(var obj2 in Memory.accessibility) {
        if(!Game.getObjectById[obj2]) {
            delete Memory.accessibility[obj2];
        }
    }
}


function getaccessibility(target, scene) {
    if (target.id in Memory.accessibility) {
        return Memory.accessibility[target.id];
    }
    try {
        const terrain = new Room.Terrain(target.room);
        var result = 0;
        for (var x = -1; x <= 1; x++) {
            for (var y = -1; x <= 1; x++) {
                if (!((x === 0) && (y === 0))) {
                    result += (terrain.get(target.pos.x - x, target.pos.y - y) != TERRAIN_MASK_WALL);
                }
            }
        }
        Memory.accessibility[target.id] = result;
        return result;
    } catch (e) {
        return 6;
    }
}

function run_tower(tower, scene) {
    var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile) {
        tower.attack(closestHostile);
    } else {
        var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (struct) => (struct.hits < scene.hitsMax) && struct.hits < struct.hitsMax * (1 - PARAMETERS.MAXDECAY)
        });
        if(closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
        }
    }
}


module.exports.loop = function () {

    if (!Memory.accessibility) {
        Memory.accessibility = {};
    }

    var scene = planscene();

    if (scene == null) {
        return false;
    }

    if (Game.time % 10 === 0) {
        if (PARAMETERS.DEBUG) {
            console.log(scene);
        }
    }

    //run all the creeps
    scene.creeps.forEach(creep => {
        run(creep, scene);
    });

    scene.towers.forEach(tower => {
        run_tower(tower, scene);
    });

    Game.spawns.forEach(spawner => {
        if (spawner.isActive()) { //check if it can be used
            if (!spawner.spawning) { //if we are not already spawning
                var parts = spawnblueprint(scene);
                if (parts.length > 0) {
                    //spawn a creeper
                    var newName = 'Worker' + Game.time;
                    if (spawner.spawnCreep(parts, newName, {memory: {role: 'idle'}}) == OK) {
                        console.log('Spawning new worker');
                    }
                }
            }
        }
    });

    cleanup();
};

/*jshint esnext: true */


function planscene(parameters) {
    //init
    if (!Memory.servers) {
       console.log("Initializing memory");
       Memory.servers = {};
    }
    var scene = {}

    //iterate over rooms (single room only for now)
    _.forEach(Game.rooms, room => {
        scene[room.name] =  {
            room: room.name,
            totalenergy: 0,
            totalcapacity: 0,
            workers: 0,
            harvesters: 0,
            carriers: 0,
            upgraders: 0,
            builders: 0,
            repairers: 0,
            idlers: 0,
            hostiles: [],
            hitsMax: 50000, //TODO: determine dynamically
            targets: {},
            parameters: parameters,
        };
        scene[room.name].totalenergy += room.energyAvailable;
        scene[room.name].totalcapacity += room.energyCapacityAvailable;
        scene[room.name].creeps = room.find(FIND_MY_CREEPS);
        scene[room.name].hostiles = room.find(FIND_HOSTILE_CREEPS);
        scene[room.name].towers =  room.find(FIND_MY_STRUCTURES, { filter: structure => structure.structureType == STRUCTURE_TOWER });
        scene[room.name].workers = 0;
        scene[room.name].creeps.forEach(creep => {
            if (!creep.memory.role) creep.memory.role = "idle";
            scene[creep.memory.role + 's']++;
            if (creep.name.substring(0,6) == "Worker") {
                scene[room.name].workers++;
            }
        });
        scene[room.name].targets = {
            harvester: room.find(FIND_SOURCES_ACTIVE),
            builder: room.find(FIND_MY_CONSTRUCTION_SITES),
            upgrader: [room.controller],
            carrier: room.find(FIND_MY_STRUCTURES, { filter: structure => {
                return ((structure.energyCapacity) && (structure.energy < structure.energyCapacity));
            }}),
            repairer: room.find(FIND_MY_STRUCTURES, { filter: structure => {
                    return (structure.hitsMax) && (structure.hits < scene[room.name].hitsMax) && (structure.hits < (1- scene[room.name].parameters.MAXDECAY) * structure.hitsMax);
            }}),
            attacker: scene[room.name].hostiles
        };
        scene[room.name].maxworkers = 0;
        scene[room.name].targets.harvester.forEach(t => {
            scene[room.name].maxworkers += getaccessibility(t, scene);
        });
        scene[room.name].maxworkers = scene[room.name].maxworkers * parameters.MAXWORKERFACTOR;
        scene[room.name].demandrole = findrole(scene[room.name]);
        runscene(scene[room.name]);
    });
}



function commission(creep, scene) {
    // commissions a creep to a target
    if (!creep) return false;
    var target = null;
    if (creep.memory.target) {
        //we already have a target, set a new one
        target = Game.getObjectById(creep.memory.target);
        decommission(null, target, scene);
        target = null;
    }
    if (creep.memory.role === "custom") {
        return;
    }
    var potentialtargets = scene.targets[creep.memory.role];
    if ((scene.parameters.DEBUG) && (potentialtargets)) {
        console.log("Looking for targets for " + creep.name + "[" + creep.memory.role + "]: " + "(" + potentialtargets.length + ") " + _.map(potentialtargets, x => x.id + " [" + x.structureType + "]"));
    }
    if (potentialtargets.length == 1) {
        //easy, only one target
        target = potentialtargets[0];
    } else if (potentialtargets.length > 1) {
        var leastservers; //tODO
        var sortedpotentialtargets = _.sortBy(potentialtargets, t => creep.pos.getRangeTo(t.pos));
        sortedpotentialtargets.forEach(function(candidate){
            if (target === null) {
                //console.log("DEBUG", creep.id, creep.memory.role, candidate.id, creep.pos.getRangeTo(candidate.pos));
                if (creep.memory.role === "harvester") {
                    if (creep.pos.inRangeTo(candidate,1)) {
                        //well, we're already in range, it'll do
                        target = candidate;
                        return;
                    } else if (!(candidate.id in Memory.servers) || (Memory.servers[candidate.id].length <= getaccessibility(candidate, scene) * scene.parameters.ACCESSIBILITYFACTOR)) {
                        //servers not full yet, good, we take this one
                        target = candidate;
                        return;
                    }
                } else if (creep.memory.role === "carrier") {
                    if (candidate.energy < candidate.energyCapacity) {
                        target = candidate;
                        return;
                    } else {

                    }
                } else {
                    //closest one suffices
                    target = candidate;
                    return;
                }
            }
        });
        //console.log("COMMISSION RESULT", target.id);
    } else {
        target = null;
    }
    if (!target) {
        console.log("Worker " + creep.name + " (" + creep.memory.role + ") can't find a target (out of " + potentialtargets.length +")");
        if (scene.parameters.DEBUG) {
            console.log("No target for " + creep.name + "[" + creep.memory.role + "]")
        }
        return null;
    }
    //commission to the target
    creep.memory.target = target.id;
    if (!(target.id in Memory.servers) || (!Memory.servers[target.id])) {
        Memory.servers[target.id] = [creep.name];
    } else if (Memory.servers[target.id].indexOf(creep.name) === -1) {
        Memory.servers[target.id].push(creep.name);
    }
    if (scene.parameters.DEBUG) {
        console.log("Added " + creep.name + " to servers for " + target.id + " [" + target.name + "]: " + JSON.stringify(Memory.servers[target.id]))
    }
    return target;
}




function run(creep, scene) {
    var target;
    if (creep.memory.role == "idle") {
        creep.memory.role = newrole(creep, scene);
        if (scene.parameters.DEBUG) {
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
            creep.say("?");
            creep.memory.role = "idle";
            creep.memory.target = null;
            return false;
        }
        if (creep.memory.role == "harvester") {
            harvester(creep, target, scene);
        } else if (creep.memory.role == "carrier") {
            carrier(creep, target, scene);
        } else if (creep.memory.role == "builder") {
            builder(creep, target, scene);
        } else if (creep.memory.role == "upgrader") {
            upgrader(creep, target, scene);
        } else if (creep.memory.role == "reserver") {
            reserver(creep, target, scene);
        //} else if (creep.memory.role == "repairer") {
        //    console.log("TODO: implement repairer!")
        }
        return true;
    }
}

function findrole(scene) {
    if ((scene.harvesters + scene.carriers > 2) && (scene.upgraders < 1)) {
        //we have no upgrader
        return "upgrader";
    } else if (scene.totalenergy < scene.parameters.MINRESERVE) {
        //not enough reserves, carry for storage
        return "harvester";
    //} else if ((scene.targets.repairer) && (scene.targets.repairer.length > 0) && (scene.repairers / scene.maxworkers < scene.parameters.REPAIRSHARE)) {
    //    return "repairer";
    } else if ((scene.targets.builder) && (scene.targets.builder.length > 0) && (scene.builders / scene.maxworkers < scene.parameters.BUILDSHARE)) {
        return "builder";
    } else if ((scene.upgraders / scene.maxworkers < scene.parameters.UPGRADESHARE)) {
        return "upgrader";
    }
    return "harvester";
}

function newrole(creep, scene) {
    //assign a role for this creep
    if ((creep.carry) && (creep.carry.energy > 0)) {
        //we have energy to do something
        if (!scene.demandrole) {
            //nothing else to do, let's upgrade!
            return "upgrader";
        } else if ((scene.demandrole == "harvester") ) {
            if (scene.targets.carrier.length > 0) {
                //we already carry energy, complete the harvest by returning it
                return "carrier";
            } else {
                return "upgrader";
            }
        } else {
            return scene.demandrole;
        }
    } else {
        //we need energy for whatever we intend to do
        return "harvester";
    }
}

function spawnblueprint(scene) {
    if (scene.demandrole != "idle") {
            if (scene.workers < 2) {
                return [WORK, CARRY, MOVE];
            } else if (scene.totalcapacity >= 800) {
                return  [WORK, WORK, CARRY,CARRY,CARRY, MOVE,MOVE, MOVE, MOVE, MOVE];
            } else if (scene.totalcapacity >= 600) {
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
        if ((creep.carry.energy == creep.carryCapacity) || (target.energy == 0)) {
            if (scene.parameters.DEBUG) {
                console.log("Worker " + creep.name + " is done harvesting")
            }
            decommission(creep, target, scene);
        }
    } else if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
    }
}


function upgrader(creep, target, scene) {
    var result = creep.upgradeController(target);
    if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {visualizePathStyle: {stroke: '#0000aa'}});
    } else if (result != OK) {
        console.log("Unexpected result for carrier: " + result);
    }
    if (creep.carry.energy === 0) {
            if (scene.parameters.DEBUG) {
                console.log("Worker " + creep.name + " is done upgrading")
            }
        decommission(creep,target, scene);
    }
}

function carrier(creep, target, scene) {
    var result = creep.transfer(target, RESOURCE_ENERGY);
    var targetfull = target.energy == target.energyCapacity;
    if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {visualizePathStyle: {stroke: '#0000ff'}});
    } else if (result == ERR_FULL) {
        //find a new target
        decommission(creep, target, scene);
        targetfull = true;
    } else if (result != OK) {
        console.log("Unexpected result for carrier: " + result);
    }
    if (targetfull) {
        if (target.id in Memory.servers) {
            Memory.servers[target.id].forEach(server_id => {
                console.log("Target is full, decomissioning " + server_id);
                var server = Game.getObjectById(server_id);
                decommission(server,target, scene);
            });
        }
    }
    if (creep.carry.energy === 0) {
        if (scene.parameters.DEBUG) {
            console.log("Worker " + creep.name + " is done carrying")
        }
        decommission(creep,target, scene);
    }
}

function builder(creep, target, scene) {
    var result = creep.build(target);
    if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {visualizePathStyle: {stroke: '#00ff00'}});
    } else if (result != OK) {
        console.log("Unexpected result for builder: " + result);
    }
    if (creep.carry.energy === 0) {
        if (scene.parameters.DEBUG) {
            console.log("Worker " + creep.name + " is done building")
        }
        decommission(creep,target, scene);
    }
}


function reserver(creep, target, scene) {
    var result = creep.reserveController(target);
    if (result == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
    } else if (result != OK) {
        console.log("Unexpected result for reserver: " + result);
    }
}

function decommission(creep, target, scene) {
    if (typeof creep !== "object") {
        throw "decommission: creep is not an object";
    }
    if (typeof target !== "object") {
        throw "decommission: target is not an object";
    }
    if (creep) {
        if (scene.parameters.DEBUG) {
            console.log("Decommissioning " + creep.name)
        }
        creep.memory.target = null;
        if ((target.id in Memory.servers) && (Memory.servers[target.id])) {
            var index = Memory.servers[target.id].indexOf(creep.name);
            if (index > -1) {
                Memory.servers[target.id].splice(index,1);
                if (scene.parameters.DEBUG) {
                    console.log("Removed " + creep.name + " [" + creep.memory.role + "] from servers for " + target.id + " [" + target.name + "]: " + JSON.stringify(Memory.servers[target.id]))
                }
            }
        }
        creep.memory.role = "idle";
    } else if (target) {
        if (target.id in Memory.servers) {
            delete Memory.servers[target.id];
        }
        if (scene.parameters.DEBUG) {
            console.log("Removed entire target " + target.id + ": " + JSON.stringify(Memory.servers[target.id]));
        }
    }
}


function cleanup(parameters) {
    //Garbage collection
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            var target_id = Memory.creeps[name].target;
            if ((target_id) && (target_id in Memory.servers)) {
                if (target_id in Memory.servers) {
                    var index = Memory.servers[target_id].indexOf(name);
                    if (index > -1) {
                        Memory.servers[target_id].splice(index,1);
                        if (parameters.DEBUG) {
                            console.log("[CLEANUP] Removed " + name + " from servers for " + target_id + ": " + JSON.stringify(Memory.servers[target_id]))
                        }
                    }
                }
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
        if (target.id == "5bbcae729099fc012e639107") { //temporary cheat
            return 1
        } else {
            return 6;
        }
    }
}

function run_tower(tower, scene) {
    var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile) {
        tower.attack(closestHostile);
    } else {
        var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (struct) => (struct.hits < scene.hitsMax) && struct.hits < struct.hitsMax * (1 - scene.parameters.MAXDECAY)
        });
        if(closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
        }
    }
}

function runscene(scene) {
    if (Game.time % 10 === 0) {
        if (scene.parameters.DEBUG) {
            console.log("**********************************************************************");
            console.log("Room " + scene.room + " Energy: " + scene.totalenergy + "/" + scene.totalcapacity + " , Workers: " + scene.workers + "/" + scene.maxworkers + ", Idlers: " + scene.idlers + ", Harvesters: " + scene.harvesters + " , Carriers: " + scene.carriers + ", Builders: " + scene.builders + "/" + Math.ceil(scene.maxworkers * scene.parameters.BUILDSHARE) + " , Repairers: " + scene.repairers + "/" + Math.ceil(scene.maxworkers * scene.parameters.REPAIRSHARE) + ", Upgraders: " + scene.upgraders +  "/" + Math.ceil(scene.maxworkers * scene.parameters.UPGRADESHARE)  + ", Demand role: " + scene.demandrole);
            console.log("**********************************************************************");
        }
    }

    //run all the creeps
    scene.creeps.forEach(creep => {
        run(creep, scene);
    });

    scene.towers.forEach(tower => {
        run_tower(tower, scene);
    });

    _.forEach(Game.spawns, spawner => {
        if (  (spawner.room.name == scene.room) && (spawner.isActive())) { //check if it can be used
            if (!spawner.spawning) { //if we are not already spawning
                var parts = spawnblueprint(scene);
                if ((parts.length > 0) && (scene.workers < scene.maxworkers)) {
                    //spawn a worker creeper
                    var newName = 'Worker' + Game.time;
                    if (spawner.spawnCreep(parts, newName, {memory: {role: 'idle'}}) == OK) {
                        console.log('--> Spawning new worker');
                    }
                }
            }
        }
    });
}

module.exports.loop = function () {

    if ((!Memory.accessibility) || (Memory.reset)) {
        Memory.accessibility = {};
    }
    if (Memory.reset) {
        console.log("Resetting!");
        Memory.servers = {};
        _.forEach(Game.creeps, creep => {
            creep.memory.role = "idle";
            creep.memory.target = null;
        });
        Memory.reset = false;
    }

    var parameters = {
        MAXDECAY: 0.2,
        MINRESERVE: 600, //minimum energy reserve
        DEBUG: true,
        MAXWORKERFACTOR: 2, //three times as many as we have access points near sources (since many will be travelling or working anyway)
        ACCESSIBILITYFACTOR: 2,
        BUILDSHARE: 0.2,
        REPAIRSHARE: 0.1,
        UPGRADESHARE: 0.2,
    }

    var scene = planscene(parameters);


    cleanup(parameters);
};



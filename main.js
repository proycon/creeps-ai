var roles = require('roles');
var structureTower = require('structure.tower');


function planscene() {
    var scene = {
        totalenergy: 0,
        totalcapacity: 0,
        harvesters: 0,
        upgraders: 0,
        builders: 0,
        need: null,
    }
    for(var roomname in Game.rooms) { //only one iteration for now, not multi-room yet
        var roomenergy = 0;
        var room = Game.rooms[roomname];
        scene.totalenergy += room.energyAvailable;
        scene.totalcapacity += room.energyCapacityAvailable;
        for (var creepname in Game.creeps) {
            var creep = Game.creeps[creepname];
            if (creep.memory.role == 'builder') {
                scene.builders++;
            } else if (creep.memory.role == 'upgrader') {
                scene.upgraders++;
            } else if (creep.memory.role == 'harvester') {
                scene.harvesters++;
            }
        }
        if ((scene.harvesters >= 2) && (scene.upgraders < Math.floor(scene.harvesters / 5) + 1)) {
            scene.need = "upgrader"; //make sure we have an upgrader if we have at least two harvesters
        } else if (scene.totalenergy < 0.5 * scene.totalcapacity) {
            scene.need = "harvester";
        } else {
            //is there something to build?
            scene.constructions = room.find(FIND_CONSTRUCTION_SITES);
            if (constructions.length)  {
                scene.need = "builder";
            } else if (scene.totalenergy < scene.totalcapacity) {
                scene.need = "harvester";
            } else {
                scene.need = "upgrader";
            }
        }
    }
    scene.sources = room.find(FIND_SOURCES_ACTIVE);
    for (var creepname in Game.creeps) {
        var creep = Game.creeps[creepname];
        run(creep);
    }
    return scene;
}

function findtarget(creep, scene) {
    if (creep.memory.role == "harvester") {
	    if (creep.carry.energy < creep.carryCapacity) {
           for (var sourcekey in scene.sources) {
               var source = scene.sources[sourcekey];
               Memory.assigned
               source.memory.assigned
           }

        } else if (creep.carry.energy > 0) {

        }
    }
}

function run(creep) {
    if (!creep.memory.target) {
        if (creep.memory.role == "harvester") {
            findtarget(creep);
        }
    }
    if (!creep.memory.target) {
        //we couldn't find a target,
        creep.memory.role = null;
    }
    return creep.memory.role;
}


function getassignment(creep) {

}


module.exports.loop = function () {


    var totalenergy = 0;
    for(var name in Game.rooms) {
        totalenergy += Game.rooms[name].energyAvailable;
    }
    var logmsg;
    if (Game.time % 10 == 0) {
        logmsg = 'Tick ' + Game.time + ', total energy: ' + totalenergy + ', satiated? ' + Memory.satiated;
    }

    for(var name in Game.structures) {
        var structure = Game.structures[name];
        if (structure.structureType == STRUCTURE_TOWER) {
            structureTower.run(structure);
        }
    }

    var harvesters = 0;
    var upgraders = 0;
    var builders = 0;
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if ((creep.memory.role == 'builder') || (creep.memory.building)) {
            builders++;
            roles.build(creep);
        } else if ((creep.memory.role == 'upgrader') || (creep.memory.upgrading)) {
            upgraders++;
            roles.upgrade(creep);
        } else if(creep.memory.role == 'harvester') {
            harvesters++;
            roles.harvest(creep);
        }
    }

    var parts = [WORK,CARRY,MOVE]
    var harvester_quotum = 2;
    var upgrader_quotum = 1;
    var builder_quotum = 1;
    if (totalenergy > 300) {
       harvester_quotum++;
    }
    if (totalenergy >= 600) {
       builder_quotum++;
       harvester_quotum++;
    }
    if (totalenergy > 1000) {
       parts = [WORK, CARRY,CARRY,MOVE,MOVE]
    }


    //spawner
    var spawner = Game.spawns['ProySpawn1'];
    if (spawner.isActive()) { //check if it can be used
        if (!spawner.spawning) { //if we are not already spawning
            if (harvesters < harvester_quotum) {
                var newName = 'Harvester' + Game.time;
                if (spawner.spawnCreep(parts, newName, {memory: {role: 'harvester'}}) == OK) {
                    console.log('Spawning new harvester: ' + newName);
                }
            } else if (upgraders < upgrader_quotum) {
                var newName = 'Upgrader' + Game.time;
                if (spawner.spawnCreep(parts, newName, {memory: {role: 'upgrader'}}) == OK) {
                    console.log('Spawning new upgrader: ' + newName);
                }
            } else if (builders < builder_quotum) {
                var newName = 'Builder' + Game.time;
                if (spawner.spawnCreep(parts, newName, {memory: {role: 'builder'}}) == OK) {
                    console.log('Spawning new builder: ' + newName);
                }
            }
        }
    }

    if (Game.time % 10 == 0) {
        console.log(logmsg + ", Harvesters: " + harvesters + "/" + harvester_quotum + ", Builders: " + builders + "/" + builder_quotum + ", Upgraders: " +  upgraders + "/" + upgrader_quotum)
    }

    //Garbage collection
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }
}

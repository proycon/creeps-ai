var roles = require('roles');
var structureTower = require('structure.tower');

module.exports.loop = function () {


    var totalenergy = 0;
    for(var name in Game.rooms) {
        totalenergy += Game.rooms[name].energyAvailable;
    }
    if (Game.time % 10 == 0) {
        console.log('Tick ' + Game.time + ', total energy: ' + totalenergy, ', Satiated? ', Memory.satiated);
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

    //spawner
    var spawner = Game.spawns['ProySpawn1'];
    if (spawner.isActive()) { //check if it can be used
        if (!spawner.spawning) { //if we are not already spawning
            if (harvesters < 2) {
                var newName = 'Harvester' + Game.time;
                if (spawner.spawnCreep([WORK,CARRY,MOVE], newName, {memory: {role: 'harvester'}}) == OK) {
                    console.log('Spawning new harvester: ' + newName);
                }
            }
            if (upgraders < 1) {
                var newName = 'Upgrader' + Game.time;
                if (spawner.spawnCreep([WORK,CARRY,MOVE], newName, {memory: {role: 'upgrader'}}) == OK) {
                    console.log('Spawning new upgrader: ' + newName);
                }
            }
            if (builders < 1) {
                var newName = 'Builder' + Game.time;
                if (spawner.spawnCreep([WORK,CARRY,MOVE], newName, {memory: {role: 'builder'}}) == OK) {
                    console.log('Spawning new builder: ' + newName);
                }
            }
        }
    }

    //Garbage collection
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }
}

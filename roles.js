var roles = {

    harvest: function(creep) {
	    if(creep.carry.energy < creep.carryCapacity) {
            if (!creep.memory.source) {
                creep.say("harvest");
                //find a source
                var sources = creep.room.find(FIND_SOURCES, {
                    filter: (s) => {
                        return (s.energy>0)
                    },
                    sortBy: function(s) { return creep.pos.getRangeTo(s) }
                });
                if (sources.length) {
                    creep.memory.sources = sources.map(s => s.id);
                    creep.memory.source = creep.memory.sources[0];
                } else {
                    console.log("No energy sources available!");
                }
            }

            var source = Game.getObjectById(creep.memory.source)
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                var moveresult = creep.moveTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                if (moveresult == OK) {
                }
            }
        } else {
            creep.memory.source = false;
            var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                    },
                    sortBy: function(structure) { return creep.pos.getRangeTo(structure) }
            });
            if(targets.length > 0) {
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#0000aa'}});
                }
                Memory.satiated = false;
            } else {
                Memory.satiated = true;
                //all structures are full of energy
                //is there stuff to build?
                var buildtargets = creep.room.find(FIND_CONSTRUCTION_SITES);
                if(buildtargets.length)  {
                    roles.build(creep);
                } else {
                    //fallback: behave as upgrader
                    roles.upgrade(creep);
                }
            }
        }
    },

    build: function(creep) {
	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.say('harvest B');
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.say('build');
	    }

	    if(creep.memory.building) {
	        var targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            if(targets.length) {
                if(creep.build(targets[0]) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {visualizePathStyle: {stroke: '#00aa00'}});
                }
            } else {
                //nothing to build, behave as a harvester
                roles.harvest(creep);
            }
	    } else {
	        var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
	    }
	},

    upgrade: function(creep) {
        if(creep.memory.upgrading && creep.carry.energy == 0) {
            creep.memory.upgrading = false;
            creep.say('harvest U');
	    }
	    if(!creep.memory.upgrading && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.upgrading = true;
	        creep.say('upgrade');
	    }

	    if(creep.memory.upgrading) {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {visualizePathStyle: {stroke: '#ff00ff'}});
            }
        }
        else {
            var sources = creep.room.find(FIND_SOURCES);
            if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                creep.moveTo(sources[0], {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }

}

module.exports = roles;

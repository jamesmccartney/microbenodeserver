/**
 * Created with JetBrains PhpStorm.
 * User: jmccartney
 * Date: 11/4/13
 * Time: 12:52 PM
 * To change this template use File | Settings | File Templates.
 */

/**************************************************
 ** Class Simulation
 **************************************************/
var async = require("async");

//Constructor
function Simulation(){
    this.running = false;
    this.paused = true;
    this.fps = 0;
    this.frameCount = 0;

    var GAME_HERTZ = 30.0;
    //ns per frame
    this.TIME_BETWEEN_UPDATES = 1000000000 / GAME_HERTZ;
    //updates before each render
    this.MAX_UPDATES_BEFORE_RENDER = 5;

    this.currentInterpolation = 0;


}

Simulation.prototype.init = function(){
    //any setup here?

};

Simulation.prototype.start = function() {
    this.running = true;
    this.paused = false;
    this.runLoop();
};

Simulation.prototype.pause = function() {
    this.paused = true;
};

Simulation.prototype.stop = function() {
    this.running = false;
};

Simulation.prototype.broadcastGame = function(interpolation){
    //console.log("broadcasting update");
    this.currentInterpolation = interpolation;
}



//Used Privately

//Main Loop
Simulation.prototype.runLoop = function(){
    //last update time
    var time = process.hrtime();
    var lastUpdateTime = time[0] * 1000000000 + time[1];
    //last render time
    time = process.hrtime();
    var lastRenderTime = time[0] * 1000000000 + time[1];
    var TARGET_FPS = 60;
    var TARGET_TIME_BETWEEN_RENDERS = 1000000000 / TARGET_FPS;
    var lastSecondTime = (lastUpdateTime / 1000000000);

    var sim = this;
    async.whilst(
        // test
        function() { return sim.running; },
        function(callback){
            //console.log("running");
            time = process.hrtime();
            var now = time[0] * 1000000000 + time[1];
            var updateCount = 0;

            if(!sim.paused){

                //Do as many game updates as we need to, potentially playing catchup.
                while( now - lastUpdateTime > sim.TIME_BETWEEN_UPDATES && updateCount < sim.MAX_UPDATES_BEFORE_RENDER )
                {
                    sim.updateGame();
                    lastUpdateTime += sim.TIME_BETWEEN_UPDATES;
                    updateCount++;
                    //console.log("doing game updates");
                }

                //If for some reason an update takes forever, we don't want to do an insane number of catchups.
                //If you were doing some sort of game that needed to keep EXACT time, you would get rid of this.
                if ( now - lastUpdateTime > sim.TIME_BETWEEN_UPDATES)
                {
                    lastUpdateTime = now - sim.TIME_BETWEEN_UPDATES;
                }

                //Render. To do so, we need to calculate interpolation for a smooth render.
                var interpolation = Math.min(1.0, ((now - lastUpdateTime) / sim.TIME_BETWEEN_UPDATES) );
                //console.log(interpolation);
                sim.broadcastGame(interpolation);
                lastRenderTime = now;

                //Update the frames we got.
                var thisSecond = (lastUpdateTime / 1000000000);
                if (thisSecond > lastSecondTime)
                {
                    lastSecondTime = thisSecond;
                }

                //Yield until it has been at least the target time between renders. This saves the CPU from hogging.
                while ( now - lastRenderTime < TARGET_TIME_BETWEEN_RENDERS && now - lastUpdateTime < sim.TIME_BETWEEN_UPDATES)
                {
                    time = process.hrtime();
                    now = time[0] * 1000000000 + time[1];
                }//while
                //console.log("yielding");

            }// end if paused
            //share compute time with other processes
            setImmediate(callback);
        },
        // done
        function (err) {
            console.log('done!');
        }
    );
};

Simulation.prototype.updateGame = function(){

}




//Export Class To Be Used
exports.Simulation = Simulation;
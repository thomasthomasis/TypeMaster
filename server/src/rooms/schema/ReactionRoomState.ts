import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {

    @type("string") id: string = "";
    @type("string") username: string = "";
    @type("number") elo: number = 1200;
    @type("boolean") ready: boolean = false;
    @type("number") reactionTime: number = 0;
    @type("number") wins: number = 0;
}

export class ReactionRoomState extends Schema {
    
    @type({ map: Player }) players = new MapSchema<Player>();
    @type("boolean") gameActive: boolean = false;
    @type("number") stimulusTime: number = 0;
    @type("number") roundNumber: number = 0;
    @type("string") countdown: string = "";
}
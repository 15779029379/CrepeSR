import Logger from '../util/Logger';
import { ActorEntity } from '../game/entities/Actor';
import Interface, { Command } from './Interface';
import { GetCurSceneInfoScRsp } from '../data/proto/StarRail';
import MazePlaneExcel from '../util/excel/MazePlaneExcel';
import MapEntryExcel from '../util/excel/MapEntryExcel';
const c = new Logger('/scene', 'blue');

export default async function handle(command: Command) {
  if (!Interface.target) {
    c.log('No target specified');
    return;
  }

  if (command.args.length == 0) {
    c.log('Usage: /scene <planeID|floorID>');
    return;
  }

  const planeData =
    MazePlaneExcel.fromFloorId(parseInt(command.args[0])) ||
    MazePlaneExcel.fromPlaneId(parseInt(command.args[0])); //Get plane data
  let floorId = 10001001; // Default floor data

  if (planeData!) {
    if (command.args[0].length === 5) {
      // If input is planeId
      floorId = planeData.StartFloorID;
    } else if (
      command.args[0].length === 8 &&
      planeData.FloorIDList.includes(parseInt(command.args[0]))
    ) {
      // If input is floorId
      floorId = parseInt(command.args[0]);
    } else {
      c.error('cannot find Scene data!', false);
      return;
    }
  } else {
    c.error('cannot find Scene data!', false);
    return;
  }

  const planeID = MazePlaneExcel.fromPlaneId(parseInt(command.args[0]));
  const entryId = MapEntryExcel.fromFloorId(planeID.StartFloorID).ID;

  const posData = Interface.target.player.db.posData;
  const lineup = await Interface.target.player.getLineup();
  const curAvatarEntity = new ActorEntity(
    Interface.target.player.scene,
    lineup.leaderSlot,
    posData.pos
  );

  const allowedScenes = ['Train', 'Town', 'Maze']; //Scenes that won't break when you relog
  // Update scene information on player.
  if (allowedScenes.includes(planeData.PlaneType)) {
    Interface.target.player.db.posData.planeID = planeData.PlaneID;
    Interface.target.player.db.posData.floorID = floorId;
    await Interface.target.player.save();
  }

  //change scene for player
  Interface.target.send(GetCurSceneInfoScRsp, {
    retcode: 0,
    scene: {
      planeId: planeData.PlaneID,
      floorId: floorId,
      entityList: [curAvatarEntity],
      entityBuffList: [],
      entryId: entryId,
      envBuffList: [],
      gameModeType: MazePlaneExcel.getGameModeForPlaneType(planeID.PlaneType),
      lightenSectionList: [],
    },
  } as unknown as GetCurSceneInfoScRsp);
  Interface.target.player.scene.spawnEntity(curAvatarEntity, true);

  Interface.target.sync();

  c.log(`Scene set to floorId: ${floorId}`);
}

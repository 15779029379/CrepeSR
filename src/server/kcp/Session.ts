import _KCP from 'node-kcp-token';
import { RemoteInfo } from 'dgram';
import { resolve } from 'path';
import fs from 'fs';
import KCP from 'node-kcp-token';
import Packet, { PacketName } from './Packet';
import Logger, { VerboseLevel } from '../../util/Logger';
import defaultHandler from '../packets/PacketHandler';
import Account from '../../db/Account';
import Player from '../../db/Player';
import { BlackLimitLevel, PlayerKickOutScNotify, PlayerKickOutScNotify_KickType, PlayerSyncScNotify } from '../../data/proto/StarRail';
import Avatar from '../../db/Avatar';
import SRServer from './SRServer';
import { HandshakeType } from './Handshake';
import ProtoFactory, { MessageType } from '../../util/ProtoFactory';

function r(...args: string[]) {
    return fs.readFileSync(resolve(__dirname, ...args));
}
type UnWrapMessageType<T> = T extends MessageType<infer U> ? U : T;

export default class Session {
    public key: Buffer = r('./initial.key');
    public c: Logger;
    public account!: Account;
    public player!: Player;
    public kicked = false;

    public constructor(private kcpobj: KCP.KCP, public readonly ctx: RemoteInfo, public id: string) {
        this.ctx = ctx;
        this.c = new Logger(`${this.ctx.address}:${this.ctx.port}`, 'yellow');
        this.update();
    }

    public inputRaw(data: Buffer) {
        if (this.kicked) return;
        this.kcpobj.input(data);
    }

    public async update() {
        if (this.kicked) return;
        if (!this.kcpobj) {
            console.error("wtf kcpobj is undefined");
            console.debug(this)
            return;
        }
        const hr = process.hrtime();

        const timestamp = hr[0] * 1000000 + hr[1] / 1000;
        this.kcpobj.update(timestamp);

        let recv;
        do {
            recv = this.kcpobj.recv();
            if (!recv) break;

            if (Packet.isValid(recv)) {
                this.handlePacket(new Packet(recv));
            }

        } while (recv)

        setTimeout(() => this.update(), 1);
    }

    public async handlePacket(packet: Packet) {
        if (Logger.VERBOSE_LEVEL >= VerboseLevel.WARNS) this.c.log(packet.protoName)
        this.c.verbL(packet.body);
        this.c.verbH(packet.rawData);

        import(`../packets/${packet.protoName}`).then(mod => {
            mod.default(this, packet);
        }).catch(e => {
            if (e.code === 'MODULE_NOT_FOUND') this.c.warn(`Unhandled packet: ${packet.protoName}`);
            else this.c.error(e);

            defaultHandler(this, packet);
        });
    }

    public async sync() {
        const avatars = await Avatar.fromUID(this.player.db._id);
        this.sendT(PlayerSyncScNotify, PlayerSyncScNotify.fromPartial({
            avatarSync: {
                avatarList: avatars.map(x => x.data),
            },
            basicInfo: this.player.db.basicInfo
        }));

        this.player.save();
    }

    public async sendT<Class extends MessageType<any>, >(type: Class, data: UnWrapMessageType<Class>) {
        const encodedBuffer = type.encode(data).finish();
        const typeName = ProtoFactory.getName(type);
        this.c.verbL(data);
        this.c.verbH(encodedBuffer);
        if (Logger.VERBOSE_LEVEL >= VerboseLevel.WARNS) this.c.log(typeName);

        //todo: might want to regen the ts-proto types with env = node
        this.kcpobj.send(Buffer.from(encodedBuffer));
    }


    public kick(hard: boolean = true) {
        SRServer.getInstance().sessions.delete(this.id);
        this.kicked = true;
        if (hard) this.sendT(PlayerKickOutScNotify, {
            kickType: PlayerKickOutScNotify_KickType.KICK_BLACK,
            blackInfo: {
                limitLevel: BlackLimitLevel.BLACK_LIMIT_LEVEL_ALL,
                beginTime: Math.round(Date.now() / 1000),
                endTime: Math.round(Date.now() / 1000),
                banType: 2
            }
        });

        SRServer.getInstance().handshake(HandshakeType.DISCONNECT, this.ctx);
    }


    /**
     * @deprecated The method should not be used
     * use sendT instead
     */
    public send(name: PacketName, body: {}) {
        this.c.verbL(body);
        const packet = Packet.encode(name, body);
        if (!packet) return;
        this.c.verbH(packet.rawData);
        if (Logger.VERBOSE_LEVEL >= VerboseLevel.WARNS) this.c.log(packet.protoName);
        this.kcpobj.send(packet.rawData);
        //i'll rename sendT to send once all instances are updated
        this.c.warn("Session.send deprecated! migrate to Session.sendT");
    }

    public sendRaw(data: Buffer) {
        if (this.kicked) return;
        this.kcpobj.send(data);
    }
}
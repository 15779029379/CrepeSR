import { GetMailScRsp, ClientMail, ItemList, Item } from "../../data/proto/StarRail";
import Config from "../../util/Config";
import Packet from "../kcp/Packet";
import Session from "../kcp/Session";

export default async function handle(session: Session, packet: Packet) {
    const mailData = Config.MAILS;

    session.send(GetMailScRsp, {
        retcode: 0,
        mailList: mailData,
        noticeMailList: [],
        start: 0,
        totalNum: 1,
        isEnd: false
    } as GetMailScRsp);
}
import { GetMailScRsp, ClientMail, ItemList, Item } from "../../data/proto/StarRail";
import Packet from "../kcp/Packet";
import Session from "../kcp/Session";

export default async function handle(session: Session, packet: Packet) {
    const mailData: ClientMail = {
        id: 1,
        templateId: 1,
        title: "CrepeSR",
        content: "be the star you want to rail\n\n\t--MemetrollsXD--",
        sender: "memetolXD + contributors gang",
        time: Math.round(Date.now() / 1000),
        attachment: {itemList: []},
        isRead: false,
        expireTime: Math.round(Date.now() / 1000) + 10000,
        paraList: [] 
    }; //TODO: Mail.json, maybe move to database and add MarkMailRead and DelMail

    session.send(GetMailScRsp, {
        retcode: 0,
        mailList: [mailData],
        noticeMailList: [],
        start: 0,
        totalNum: 1,
        isEnd: false
    } as GetMailScRsp);
}
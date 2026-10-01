import {StringDecoder} from 'node:string_decoder';
import {CDP} from './common.mjs';

class PipeSocket extends EventTarget {
  constructor(child,maxBytes) {
    super();this.child=child;this.writer=child.stdio[3];this.reader=child.stdio[4];this.buffer='';this.decoder=new StringDecoder('utf8');
    if(!this.writer||!this.reader)throw new Error('Chrome debugging pipes were not created');
    this.reader.on('data',chunk=>{
      this.buffer+=this.decoder.write(chunk);
      for(;;){const end=this.buffer.indexOf('\0');if(end<0)break;const data=this.buffer.slice(0,end);this.buffer=this.buffer.slice(end+1);if(Buffer.byteLength(data)>maxBytes){this.dispatchEvent(new Event('error'));this.close();return;}this.dispatchEvent(new MessageEvent('message',{data}));}
      if(Buffer.byteLength(this.buffer)>maxBytes){this.dispatchEvent(new Event('error'));this.close();}
    });
    for(const stream of [this.writer,this.reader])stream.on('error',()=>this.dispatchEvent(new Event('error')));
    child.once('exit',()=>this.dispatchEvent(new Event('close')));child.once('error',()=>this.dispatchEvent(new Event('error')));
  }
  send(message){if(this.writer.destroyed)throw new Error('CDP pipe is closed');this.writer.write(message+'\0');}
  close(){this.writer.destroy();this.reader.destroy();}
}
export function pipeCDP(child,maxMessageBytes=32000000) {return new CDP(new PipeSocket(child,maxMessageBytes),{maxMessageBytes});}

import { ScriptRunResouce } from "@App/app/repo/scripts";
import { Message } from "@Packages/message/server";

export class InjectRuntime {
  constructor(
    private msg: Message,
    private scripts: ScriptRunResouce[]
  ) {}

  start(){}
}

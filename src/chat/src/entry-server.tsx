// @refresh skip
import { createHandler, StartServer } from "@solidjs/start/server";

function Document(props: { assets: any; scripts: any }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Alice Chat</title>
        {props.assets}
      </head>
      <body>
        <div id="app"></div>
        {props.scripts}
      </body>
    </html>
  );
}

export default createHandler(() => <StartServer document={Document} />);

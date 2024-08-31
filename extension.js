const vscode = require("vscode");
const { default: OpenAI } = require("openai");

module.exports = {
  activate: (ctx) => {
    let api;
    const initAPI = async () => {
      api = new OpenAI({ baseURL: await ctx.secrets.get("openai-url") ?? "https://api.openai.com/v1/", apiKey: await ctx.secrets.get("openai-key") });
    };
    initAPI();
    ctx.secrets.onDidChange((event) => {
      if (event.key === "openai-key") initAPI();
    });
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: "**" },
      {
        provideInlineCompletionItems: async (document, position) => {
          if (!api) {
            const res = await vscode.window.showErrorMessage(
              "You must configure an OpenAI API Key!",
              "Set Key"
            );
            if (res)
              await vscode.commands.executeCommand("khaopilot.token");
            return;
          }
          const prefix = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
          const suffix = document.getText(new vscode.Range(position, document.positionAt(document.getText().length)));
          const prompt =
            vscode.workspace.getConfiguration("khaopilot").get("prompt") || `You provide code completion results given a prefix and suffix.
Respond with a JSON object with the key 'completion' containing a suggestion to place between the prefix and suffix.
Follow existing code styles. Listen to comments at the end of the prefix. The language is "{language}".`;

          const response = await api.chat.completions.create({
            messages: [
              {
                role: "system",
                content: prompt.replace("{language}", document.languageId),
              },
              { role: "user", content: prefix },
              { role: "user", content: suffix },
            ],
            model: ctx.secrets.get("openai-model") ?? "gpt-4o",
            max_tokens: 500,
            response_format: { type: "json_object" },
          });
          const resp = JSON.parse(response.choices[0].message.content);
          return {
            items: [{ insertText: resp.completion.trim() }],
          };
        },
      }
    );
    vscode.commands.registerCommand("khaopilot.token", async () => {
      const resBaseURL = await vscode.window.showInputBox({
        title: "OpenAI Base URL",
        prompt: "Set the OpenAI Base URL",
        ignoreFocusOut: true,
        password: true,
      });
			const resKey = await vscode.window.showInputBox({
        title: "OpenAI Key",
        prompt: "Set the OpenAI Key",
        ignoreFocusOut: true,
        password: true,
      });
			const resModel = await vscode.window.showInputBox({
        title: "OpenAI Model",
        prompt: "Set a OpenAI Model",
        ignoreFocusOut: true,
        password: true,
      });
      if (resKey) {
				if (resBaseURL) await ctx.secrets.store("openai-url", resBaseURL); 
				if (resModel) await ctx.secrets.store("openai-model", resModel); 
        await ctx.secrets.store("openai-key", resKey);
        vscode.window.showInformationMessage("KhaoPilot is working!");
        initAPI();
      }
    });
  },
};

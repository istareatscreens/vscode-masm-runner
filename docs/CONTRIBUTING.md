👍 Thank you for taking the time to contribute! 👍

# Development

- Please make sure you are using node version >16 and have gulp installed:

`npm install -g gulp`

- Ensure you run in project root and extension directory:

`npm install`

- This project uses git lfs so ensure you have it installed

- To build the project development simply run:

`npm run watch`

from the following directories

- vscode-masm-runner/
- vscode-masm-runner/extension/

# Debugging and Testing

Uninstall MASM Runner from marketplace before testing as it will conflict with your development version.

In vscode go to `File->Add Folder to Workspace..` and navigate to the `vscode-masm-runner/extension/` directory, you should then navigate to Run and Debug and click the green play button with `Run Extension` selected.

For developer console for webview simply search for `>developer tools` in code navigation (ctrl+p or command+p)

# Branch naming

Please use the following branch naming scheme:

- `feature/name-of-feature` - for feature
- `bug/name-of-bug` - for bug fix
- `doc/name-of-change` - for doc update

# Pull Requests

- If you would like to expand on the functionality of this extension please post an issue first to discuss possible implementation

- Please ensure that PRs contain squashed commits.

# Further Information:

- Discussion regarding boxedwine setup/issues:
  https://github.com/danoon2/Boxedwine/discussions/60

# Contact

Feel free to join this [discord server](https://discord.gg/EN7937W2) if you are interested in contributing and need help or have any issues.

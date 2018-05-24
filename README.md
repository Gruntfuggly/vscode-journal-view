# VSCode Journal View

This extension adds an explorer viewlet (tree view) to the excellent [vscode-journal](https://marketplace.visualstudio.com/items?itemName=Pajoma.vscode-journal) extension allowing quick access to the journal files.

The three icons on the view title bar are Today, Filter and Refresh. The Today button opens a new journal entry for the current date (if required) and opens it. The Filter button prompts for a search string and hides any journal entries which don't contain it. Click the Clear button (where the Filter button was) to remove the filter.

The view is also now available in a custom view in the activity bar aswell as the Explorer view. You can hide or show the view in the Explorer view by right clicking any of the view titlebars. You can hide or show the icon in the activity bar by right clicking anywhere in the activity bar.

## Installing

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.vscode-journal-view).

Alternatively, open Visual Studio code, press `Ctrl+P` or `Cmd+P` and type:

    > ext install vscode-journal-view

## Configuration

The extension can be customised as follows:

`vscode-journal-view.initial`

Determines how the tree is initially displayed. Can be 'collapsed', 'expanded' or 'today'.

## Known issues

The 'today' setting of `vscode-journal-view.initial` has temporarily been disabled as it causes the journal view to be shown in the activity bar even when the user has previously hidden it. This has been raised as a vscode [issue](https://github.com/Microsoft/vscode/issues/50274). The Today button can still be pressed to reveal the current day's journal entry.

Month and day names should be shown according to your locale, but ordinal indicators (st, nd, rd, etc.) are only English. If anybody knows how to do this in javascript please tell me!

### Source Code

The source code is available on GitHub [here](https://github.com/Gruntfuggly/vscode-journal-view).

### Credits

Pajoma, for the actual implementation of the Journal. I reused the icon too (sorry).

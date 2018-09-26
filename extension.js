
var vscode = require( 'vscode' );
var TreeView = require( "./dataProvider" );
var childProcess = require( 'child_process' );
var fs = require( 'fs' );
var path = require( 'path' );
var os = require( 'os' );
var findInFile = require( 'find-in-file' );

function activate( context )
{
    var shouldDebug = vscode.workspace.getConfiguration( 'vscode-journal-view' ).debug;
    var outputChannel = shouldDebug ? vscode.window.createOutputChannel( "vscode-journal-view" ) : undefined;

    var currentSearchTerm;
    vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-is-filtered', false );

    var provider = new TreeView.JournalDataProvider( context, outputChannel );

    var journalViewExplorer = vscode.window.createTreeView( "vscode-journal-view-explorer", { treeDataProvider: provider } );
    var journalView = vscode.window.createTreeView( "vscode-journal-view", { treeDataProvider: provider } );

    const decorationType = vscode.window.createTextEditorDecorationType( {
        overviewRulerColor: new vscode.ThemeColor( 'editor.findMatchHighlightBackground' ),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        light: { backgroundColor: new vscode.ThemeColor( 'editor.findMatchHighlightBackground' ) },
        dark: { backgroundColor: new vscode.ThemeColor( 'editor.findMatchHighlightBackground' ) }
    } );

    function getExt()
    {
        var extension = vscode.workspace.getConfiguration( 'journal' ).ext;
        if( extension.indexOf( '.' ) === -1 )
        {
            extension = '.' + extension;
        }
        return extension;
    }

    function revealToday( revealInExplorer )
    {
        var today = new Date().toISOString().substr( 0, 10 ).replace( /\-/g, path.sep ) + getExt();
        var node = provider.getElement( getRootFolder(), today );
        if( node )
        {
            if( revealInExplorer )
            {
                journalViewExplorer.reveal( node );
            }
            else
            {
                journalView.reveal( node );
            }
        }
    }

    function scan( dir, done )
    {
        var extension = getExt();
        var results = [];
        fs.readdir( dir, function( err, list )
        {
            if( err ) return done( err );
            var i = 0;
            ( function next()
            {
                var file = list[ i++ ];
                if( !file ) return done( null, results );
                file = path.join( dir, file );
                fs.stat( file, function( err, stat )
                {
                    if( stat && stat.isDirectory() )
                    {
                        scan( file, function( err, res )
                        {
                            results = results.concat( res );
                            next();
                        } );
                    }
                    else
                    {
                        if( path.extname( file ) === extension )
                        {
                            results.push( file );
                        }
                        next();
                    }
                } );
            } )();
        } );
    }

    function getRootFolder()
    {
        var rootFolder = vscode.workspace.getConfiguration( 'journal' ).base;
        if( rootFolder === "" )
        {
            rootFolder = path.resolve( os.homedir(), "Journal" );
        }
        return rootFolder;
    }

    function isJournalFile( filename )
    {
        const rootFolder = getRootFolder();

        if( rootFolder )
        {
            return filename.indexOf( rootFolder.substr( 1 ) ) === 1;
        }
    }

    function refresh()
    {
        provider.clear();
        currentFilter = undefined;
        vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-is-filtered', false );

        const rootFolder = getRootFolder();

        scan( rootFolder, function( error, files )
        {
            if( files )
            {
                files.map( function( path )
                {
                    provider.add( rootFolder, path );
                } );
            }
            provider.refresh();
        } );
    }

    function search( term )
    {
        const rootFolder = getRootFolder();

        scan( rootFolder, function( error, files )
        {
            var count = files.length;
            provider.setAllVisible( false );

            if( files )
            {
                files.map( function( path )
                {
                    findInFile( { files: path, find: new RegExp( term, 'gi' ) }, function( err, matched )
                    {
                        if( !err && matched.length > 0 )
                        {
                            provider.setVisible( rootFolder, path );
                        }
                        if( --count === 0 )
                        {
                            provider.refresh();
                        }
                    } );
                } );
            }
        } );

        var editor = vscode.window.activeTextEditor
        if( editor && isJournalFile( editor.document.fileName ) )
        {
            highlightSearchTerm( false );
        }
    }

    function highlightSearchTerm( positionCursor )
    {
        var terms = [];
        var position;

        var editor = vscode.window.activeTextEditor;

        if( currentSearchTerm )
        {
            const text = editor.document.getText();
            let match;
            while( match = currentSearchTerm.exec( text ) )
            {
                const startPos = editor.document.positionAt( match.index );
                const endPos = editor.document.positionAt( match.index + match[ 0 ].length );
                const decoration = { range: new vscode.Range( startPos, endPos ) };
                terms.push( decoration );

                if( position === undefined )
                {
                    position = startPos;
                }
            }
        }
        editor.setDecorations( decorationType, terms );

        if( positionCursor )
        {
            if( position === undefined )
            {
                position = new vscode.Position( 2, 0 );
            }

            editor.selection = new vscode.Selection( position, position );
            editor.revealRange( editor.selection, vscode.TextEditorRevealType.Default );
        }
    }

    function clearFilter()
    {
        currentFilter = undefined;
        vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-is-filtered', false );
        provider.setAllVisible( true );
        provider.refresh();
    }

    function setButtons()
    {
        var expanded = vscode.workspace.getConfiguration( 'vscode-journal-view' ).expanded;
        vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-show-expand', !expanded );
        vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-show-collapse', expanded );
    }

    function collapse()
    {
        vscode.workspace.getConfiguration( 'vscode-journal-view' ).update( 'expanded', false, false );
    }

    function expand()
    {
        vscode.workspace.getConfiguration( 'vscode-journal-view' ).update( 'expanded', true, false );
    }

    function register()
    {
        vscode.window.registerTreeDataProvider( 'vscode-journal-view', provider );

        var xmlExtension = vscode.extensions.getExtension( 'pajoma.vscode-journal' );
        if( xmlExtension.isActive === false )
        {
            xmlExtension.activate().then(
                function() { },
                function()
                {
                    console.log( "Extension pajoma.vscode-journal activation failed" );
                }
            );
        }

        vscode.commands.registerCommand( 'vscode-journal-view.open', ( file ) =>
        {
            vscode.workspace.openTextDocument( file ).then( function( document )
            {
                vscode.window.showTextDocument( document ).then( function( editor )
                {
                    vscode.commands.executeCommand( 'workbench.action.focusActiveEditorGroup' );

                    highlightSearchTerm( file !== document.fileName );
                } );
            } );
        } );

        context.subscriptions.push( vscode.workspace.onDidChangeConfiguration( function( e )
        {
            if( e.affectsConfiguration( "vscode-journal-view" ) ||
                e.affectsConfiguration( "journal.base" ) )
            {
                setButtons();
                provider.rebuild();
                refresh();
                vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-in-explorer', vscode.workspace.getConfiguration( 'vscode-journal-view' ).showInExplorer );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.refresh', refresh ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.expand', expand ) );
        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.collapse', collapse ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.search', function()
        {
            vscode.window.showInputBox( { prompt: "Search the journal" } ).then(
                function( term )
                {
                    currentSearchTerm = term !== undefined ? new RegExp( term, 'gi' ) : undefined;
                    if( term )
                    {
                        vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-is-filtered', true );
                        search( term );
                    }
                } );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.clearFilter', clearFilter ) );

        function revealButtonPressed( revealInExplorer )
        {
            vscode.commands.executeCommand( "journal.today" ).then( function()
            {
                revealToday( revealInExplorer );
            } );
        }

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.todayInExplorer', function()
        {
            revealButtonPressed( true );
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.today', function()
        {
            revealButtonPressed( false );
        } ) );

        vscode.commands.executeCommand( 'setContext', 'vscode-journal-view-in-explorer', vscode.workspace.getConfiguration( 'vscode-journal-view' ).showInExplorer );

        refresh();
        setButtons();
    }

    var onSave = vscode.workspace.onDidSaveTextDocument( ( e ) =>
    {
        if( isJournalFile( e.fileName ) )
        {
            provider.add( getRootFolder(), e.fileName );
            provider.refresh();
        }
    } );

    register();
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;

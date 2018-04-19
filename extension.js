
var vscode = require( 'vscode' );
var TreeView = require( "./dataProvider" );
var childProcess = require( 'child_process' );
var fs = require( 'fs' );
var path = require( 'path' );
var os = require( 'os' );
var findInFile = require( 'find-in-file' );

function activate( context )
{
    var currentSearchTerm;

    var provider = new TreeView.JournalDataProvider( context );

    var journalView = vscode.window.createTreeView( "vscode-journal-view", { treeDataProvider: provider } );

    const decorationType = vscode.window.createTextEditorDecorationType( {
        overviewRulerColor: new vscode.ThemeColor( 'editor.findMatchHighlightBackground' ),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        light: { backgroundColor: new vscode.ThemeColor( 'editor.findMatchHighlightBackground' ) },
        dark: { backgroundColor: new vscode.ThemeColor( 'editor.findMatchHighlightBackground' ) }
    } );

    function revealToday()
    {
        var today = new Date().toISOString().substr( 0, 10 ).replace( /\-/g, path.sep ) + vscode.workspace.getConfiguration( 'journal' ).ext;
        var node = provider.getElement( getRootFolder(), today );
        if( node )
        {
            journalView.reveal( node );
        }
    }

    function scan( dir, done )
    {
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
                    } else
                    {
                        if( path.extname( file ) === vscode.workspace.getConfiguration( 'journal' ).ext )
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

    function refresh( reveal )
    {
        currentSearchTerm = undefined;
        provider.clear();

        const rootFolder = getRootFolder();

        scan( rootFolder, function( error, results )
        {
            if( results )
            {
                results.map( function( path )
                {
                    provider.add( rootFolder, path );
                } );

                provider.refresh();

                if( reveal )
                {
                    setTimeout( revealToday, 500 );
                }
            }
        } );
    }
    function doReveal( nodes )
    {
        nodes.forEach( journalView.reveal );
    }

    function search( term )
    {
        const rootFolder = getRootFolder();

        scan( rootFolder, function( error, results )
        {
            provider.setAllVisible( false );
            provider.refresh();

            var revealNodes = [];
            var revealTimer;

            if( results )
            {
                results.map( function( path )
                {
                    if( findInFile( { files: path, find: new RegExp( term, 'gi' ) }, function( err, matched )
                    {
                        if( !err && matched.length > 0 )
                        {
                            provider.setVisible( rootFolder, path );
                            var node = provider.getElement( rootFolder, path );
                            if( node )
                            {
                                revealNodes.push( node );
                                clearTimeout( revealTimer );
                                revealTimer = setTimeout( doReveal, 1000, revealNodes );
                            }
                        }
                    } ) );
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

    function register()
    {
        vscode.window.registerTreeDataProvider( 'vscode-journal-view', provider );

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

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.refresh', refresh ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.search', function()
        {
            if( currentSearchTerm )
            {
                currentSearchTerm = undefined;
                provider.setAllVisible( true );
                provider.refresh();
            }
            else
            {
                vscode.window.showInputBox( { prompt: "Search the journal" } ).then(
                    function( term )
                    {
                        currentSearchTerm = term !== undefined ? new RegExp( term, 'gi' ) : undefined;
                        if( term )
                        {
                            search( term );
                        }
                    } );
            }
        } ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.today',
            function()
            {
                var xmlExtension = vscode.extensions.getExtension( 'pajoma.vscode-journal' );
                if( xmlExtension.isActive === false )
                {
                    xmlExtension.activate().then(
                        function()
                        {
                            vscode.commands.executeCommand( "journal.today" );
                            revealToday();
                        },
                        function()
                        {
                            console.log( "Extension pajoma.vscode-journal activation failed" );
                        }
                    );
                } else
                {
                    vscode.commands.executeCommand( "journal.today" );
                    revealToday();
                }

            } ) );

        refresh( vscode.workspace.getConfiguration( 'vscode-journal-view' ).initial === "today" );
    }

    var onSave = vscode.workspace.onDidSaveTextDocument( ( e ) =>
    {
        if( isJournalFile( e.fileName ) )
        {
            provider.add( getRootFolder(), e.fileName );
        }
    } );

    register();
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;

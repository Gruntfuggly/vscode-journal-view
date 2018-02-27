
var vscode = require( 'vscode' );
var TreeView = require( "./dataProvider" );
var childProcess = require( 'child_process' );
var fs = require( 'fs' );
var path = require( 'path' );
var os = require( 'os' );
var findInFile = require( 'find-in-file' );

function activate( context )
{
    var provider = new TreeView.JournalDataProvider( context );

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
                file = dir + '/' + file;
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

    function refresh()
    {
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

                var today = new Date().toISOString().substr( 0, 10 ).replace( /\-/g, path.sep ) + vscode.workspace.getConfiguration( 'journal' ).ext;
                provider.expand( getRootFolder(), today );

                provider.refresh();
            }
        } );
    }

    function search( term )
    {
        provider.clear();

        const rootFolder = getRootFolder();

        scan( rootFolder, function( error, results )
        {
            if( results )
            {
                results.map( function( path )
                {
                    if( findInFile( { files: path, find: term }, function( err, matched )
                    {
                        if( !err && matched.length > 0 )
                        {
                            provider.add( rootFolder, path );
                            provider.expand( rootFolder, path );
                        }
                    } ) );
                } );
                provider.refresh();
            }
        } );
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
                    var position = new vscode.Position( 2, 0 );
                    editor.selection = new vscode.Selection( position, position );
                    editor.revealRange( editor.selection, vscode.TextEditorRevealType.Default );
                    vscode.commands.executeCommand( 'workbench.action.focusActiveEditorGroup' );
                } );
            } );
        } );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.refresh', refresh ) );

        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.search', function()
        {
            vscode.window.showInputBox( { prompt: "Search the journal" } ).then(
                function( term )
                {
                    if( term )
                    {
                        search( term );
                    }
                } );
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
                        },
                        function()
                        {
                            console.log( "Extension pajoma.vscode-journal activation failed" );
                        }
                    );
                } else
                {
                    vscode.commands.executeCommand( "journal.today" );
                }

            } ) );

        refresh();
    }

    var onSave = vscode.workspace.onDidSaveTextDocument( ( e ) =>
    {
        const rootFolder = getRootFolder();

        if( rootFolder )
        {
            if( e.fileName.indexOf( rootFolder.substr( 1 ) ) === 1 )
            {
                provider.add( rootFolder, e.fileName );
            }
        }
    } );

    register();
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;


var vscode = require( 'vscode' );
var TreeView = require( "./dataProvider" );
var childProcess = require( 'child_process' );
var fs = require( 'fs' );
var path = require( 'path' );
var os = require( 'os' );

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

    function populate()
    {
        var rootFolder = vscode.workspace.getConfiguration( 'journal' ).base;
        if( rootFolder === "" )
        {
            rootFolder = path.resolve( os.homedir(), "Journal" );
        }
        console.log( rootFolder );
        scan( rootFolder, function( error, results )
        {
            results.map( function( path )
            {
                provider.add( rootFolder, path );
            } );
            provider.refresh();
        } );
    }

    function refresh()
    {
        provider.clear();

        populate();
    }

    function register()
    {
        var findCommand = function()
        {
            vscode.commands.getCommands( true ).then(
                function( cmd )
                {
                    console.log( "fulfilled" );
                    console.log( cmd );
                },
                function()
                {
                    console.log( "failed" );
                    console.log( arguments );
                }
            );
        };

        findCommand();

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
        context.subscriptions.push( vscode.commands.registerCommand( 'vscode-journal-view.today',
            function()
            {
                var xmlExtension = vscode.extensions.getExtension( 'pajoma.vscode-journal' );
                if( xmlExtension.isActive == false )
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

    register();
}

function deactivate()
{
}

exports.activate = activate;
exports.deactivate = deactivate;

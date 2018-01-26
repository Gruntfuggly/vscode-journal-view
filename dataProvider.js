Object.defineProperty( exports, "__esModule", { value: true } );
var vscode = require( 'vscode' ),
    path = require( "path" ),
    fs = require( 'fs' );

var elements = [];

const PATH = "path";
const ENTRY = "entry";

var getMonth = function( number )
{
    var date = new Date();
    date.setMonth( number );
    return date.toLocaleString( vscode.env.language, { month: "long" } );
}

class JournalDataProvider
{
    constructor( _context )
    {
        this._context = _context;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getChildren( element )
    {
        if( !element )
        {
            if( elements.length > 0 )
            {
                return elements;
            }
            return [ { name: "Nothing found" } ];
        }
        else if( element.type === PATH )
        {
            if( element.elements && element.elements.length > 0 )
            {
                return element.elements;
            }
            else
            {
                return element.entries;
            }
        }
        else if( element.type === ENTRY )
        {
            return element.text;
        }
    }

    getIcon()
    {
        var icon = {
            dark: this._context.asAbsolutePath( path.join( "resources/icons", "dark", "journal-entry.svg" ) ),
            light: this._context.asAbsolutePath( path.join( "resources/icons", "light", "journal-entry.svg" ) )
        };

        return icon;
    }

    getTreeItem( element )
    {
        let treeItem = new vscode.TreeItem( element.name + ( element.pathLabel ? element.pathLabel : "" ) );
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.resourceUri = new vscode.Uri.file( element.file );

        if( element.type === PATH )
        {
            treeItem.collapsibleState = vscode.workspace.getConfiguration( 'vscode-journal-tree' ).expanded ?
                vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        }
        else if( element.type === ENTRY )
        {
            treeItem.iconPath = this.getIcon();

            treeItem.command = {
                command: "vscode-journal-view.open",
                title: "",
                arguments: [
                    element.file
                ]
            };
        }

        return treeItem;
    }

    clear()
    {
        elements = [];
        vscode.commands.executeCommand( 'setContext', 'journal-tree-has-content', false );
        this._onDidChangeTreeData.fire();
    }

    add( rootFolder, entryPath )
    {
        vscode.commands.executeCommand( 'setContext', 'journal-tree-has-content', true );

        var fullPath = path.resolve( rootFolder, entryPath );
        var relativePath = path.relative( rootFolder, fullPath );
        var parts = relativePath.split( path.sep );

        var pathElement;

        var entryElement = {
            type: ENTRY, name: path.parse( parts.pop() ).name, file: fullPath
        };

        function findSubPath( e )
        {
            return e.type === PATH && e.name === this;
        }

        var parent = elements;
        parts.map( function( p, level )
        {
            if( level === parts.length - 1 )
            {
                p = getMonth( p );
            }

            var child = parent.find( findSubPath, p );
            if( !child )
            {
                var subPath = path.join( rootFolder, parts.slice( 0, level + 1 ).join( path.sep ) );
                pathElement = {
                    type: PATH, file: subPath, name: p, parent: pathElement, elements: [], entries: []
                };

                parent.push( pathElement );
            }
            else
            {
                pathElement = child;
            }
            parent = pathElement.elements;
        } );

        pathElement.entries.push( entryElement );

        this._onDidChangeTreeData.fire();
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }
}
exports.JournalDataProvider = JournalDataProvider;

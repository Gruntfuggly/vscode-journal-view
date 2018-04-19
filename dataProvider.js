Object.defineProperty( exports, "__esModule", { value: true } );
var vscode = require( 'vscode' ),
    path = require( "path" ),
    fs = require( 'fs' );

var noteRegex = new RegExp( "\\d\\d\\d\\d\\" + path.sep + "\\d\\d\\" + path.sep + "\\d\\d\\" + path.sep + ".*" + vscode.workspace.getConfiguration( 'journal' ).ext + "$" );
var entryRegex = new RegExp( "\\d\\d\\d\\d\\" + path.sep + "\\d\\d\\" + path.sep + "\\d\\d" + vscode.workspace.getConfiguration( 'journal' ).ext + "$" );

var elements = [];

const PATH = "path";
const ENTRY = "entry";
const NOTE = "note";

var expandView = vscode.workspace.getConfiguration( 'vscode-journal-view' ).initial === "expanded";

var rootFolder;

String.prototype.endsWith = function( suffix )
{
    return this.indexOf( suffix, this.length - suffix.length ) !== -1;
};

var getMonth = function( number )
{
    var date = new Date();
    date.setMonth( parseInt( number ) - 1 );
    return date.toLocaleString( vscode.env.language, { month: "long" } );
}

var getDay = function( date )
{
    function nth( n ) { return [ "st", "nd", "rd" ][ ( ( n + 90 ) % 100 - 10 ) % 10 - 1 ] || "th" }

    return date.toLocaleString( vscode.env.language, { weekday: 'long' } ) + ' ' + date.getDate() + nth( date.getDate() );
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
            var roots = elements.filter( e => e.visible );
            if( roots.length > 0 )
            {
                return roots;
            }
            return [ { displayName: "Nothing found" } ];
        }
        else if( element.type === PATH )
        {
            return element.elements.filter( e => e.visible );
        }
        else if( element.type === ENTRY )
        {
            if( element.notes )
            {
                return element.notes;
            }
            return element.text;
        }
    }

    getIcon( name )
    {
        var icon = {
            dark: this._context.asAbsolutePath( path.join( "resources/icons", "dark", name + ".svg" ) ),
            light: this._context.asAbsolutePath( path.join( "resources/icons", "light", name + ".svg" ) )
        };

        return icon;
    }

    getParent( element )
    {
        return element.parent;
    }

    getTreeItem( element )
    {
        let treeItem = new vscode.TreeItem( element.displayName + ( element.pathLabel ? element.pathLabel : "" ) );
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        if( element.file )
        {
            treeItem.resourceUri = new vscode.Uri.file( element.file );
        }

        if( element.type === PATH )
        {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }

        if( element.icon )
        {
            treeItem.iconPath = this.getIcon( element.icon );
        }

        if( element.clickable )
        {
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
        var isNote = noteRegex.test( entryPath );
        var isEntry = entryRegex.test( entryPath );

        if( !isNote && !isEntry )
        {
            return;
        }

        var today = new Date().toISOString().substr( 0, 10 ).replace( /\-/g, path.sep ) + vscode.workspace.getConfiguration( 'journal' ).ext;

        var fullPath = path.resolve( rootFolder, entryPath );
        var relativePath = path.relative( rootFolder, fullPath );
        var parts = relativePath.split( path.sep );

        var day;
        var dayNumber;
        var note;
        if( isEntry )
        {
            day = parts.pop();
            dayNumber = parseInt( path.parse( day ).name );
        }
        else
        {
            dayNumber = parseInt( parts[ parts.length - 2 ] );
            day = dayNumber + vscode.workspace.getConfiguration( 'journal' ).ext;
            parts[ parts.length - 2 ] = day;
            note = parts.pop();
        }

        var dayName = getDay( new Date( parseInt( parts[ 0 ] ), parseInt( parts[ 1 ] ) - 1, dayNumber ) );

        var pathElement;

        var entryElement = {
            type: isNote ? NOTE : ENTRY,
            name: isNote ? note : day,
            file: fullPath,
            // id: fullPath.replace,
            icon: isNote ? "notes" : "journal-entry",
            clickable: true,
            visible: true
        };

        function findSubPath( e )
        {
            return e.name === this;
        }

        var parent = elements;
        parts.map( function( p, level )
        {
            var child = parent.find( findSubPath, p );
            if( !child )
            {
                var subPath = path.join( rootFolder, parts.slice( 0, level + 1 ).join( path.sep ) );
                pathElement = {
                    type: PATH,
                    file: subPath,
                    name: p,
                    displayName: ( level === 1 ) ? getMonth( p ) : ( isNote ? dayName : p ),
                    parent: pathElement,
                    elements: [],
                    visible: true
                };

                if( level === 2 )
                {
                    pathElement.icon = "journal-entry";
                    pathElement.clickable = true;
                }

                parent.push( pathElement );
            }
            else
            {
                pathElement = child;
            }
            parent = pathElement.elements;
        } );

        if( !pathElement.elements.find( function( e ) { return e.name === this; }, entryElement.name ) )
        {
            entryElement.parent = pathElement;

            if( isEntry )
            {
                entryElement.displayName = dayName;
            }
            else
            {
                entryElement.displayName = path.basename( entryElement.name, vscode.workspace.getConfiguration( 'journal' ).ext ).replace( /_/g, ' ' );
            }

            pathElement.elements.push( entryElement );

            this._onDidChangeTreeData.fire();
        }
    }

    setVisible( rootFolder, entryPath )
    {
        var fullPath = path.resolve( rootFolder, entryPath );
        var relativePath = path.relative( rootFolder, fullPath );
        var parts = relativePath.split( path.sep );

        function findSubPath( e )
        {
            return e.name === this;
        }

        var parent = elements;
        parts.map( function( p, level )
        {
            var child = parent.find( findSubPath, p );
            if( level === 2 && !p.endsWith( ".md" ) )
            {
                child = parent.find( findSubPath, p + ".md" );
            }
            child.visible = true;
            parent = child.elements;
        } );
    }

    getElement( rootFolder, date )
    {
        var fullPath = path.resolve( rootFolder, date );
        var relativePath = path.relative( rootFolder, fullPath );
        var parts = relativePath.split( path.sep );

        var level = 0;

        function findSubPath( e )
        {
            return e.name === this;
        }

        var found;
        var element = elements.find( findSubPath, parts[ level ] );
        while( element !== undefined )
        {
            ++level;
            found = element;
            var part = parts[ level ];
            if( level === 2 && !part.endsWith( ".md" ) )
            {
                part += ".md";
            }
            element = element.elements ? element.elements.find( findSubPath, part ) : undefined;
        }

        return found;
    }

    refresh()
    {
        this._onDidChangeTreeData.fire();
    }

    setAllVisible( visible, children )
    {
        if( children === undefined )
        {
            children = elements;
        }
        children.forEach( child =>
        {
            child.visible = visible;
            if( child.elements )
            {
                this.setAllVisible( visible, child.elements );
            }
        } );
    }
}
exports.JournalDataProvider = JournalDataProvider;

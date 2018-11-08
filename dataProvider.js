Object.defineProperty( exports, "__esModule", { value: true } );
var vscode = require( 'vscode' );
var path = require( "path" );

function getExt()
{
    var extension = vscode.workspace.getConfiguration( 'journal' ).ext;
    if( extension.indexOf( '.' ) === -1 )
    {
        extension = '.' + extension;
    }
    return extension;
}

var noteRegex = new RegExp( "\\d\\d\\d\\d\\" + path.sep + "\\d\\d\\" + path.sep + "\\d\\d\\" + path.sep + ".*" + getExt() + "$" );
var entryRegex = new RegExp( "\\d\\d\\d\\d\\" + path.sep + "\\d\\d\\" + path.sep + "\\d\\d" + getExt() + "$" );

var elements = [];

const PATH = "path";
const ENTRY = "entry";
const NOTE = "note";

String.prototype.endsWith = function( suffix )
{
    return this.indexOf( suffix, this.length - suffix.length ) !== -1;
};

function twoDigits( value )
{
    return ( value < 10 ) ? "0" + value : value;
}

var getMonth = function( number )
{
    var date = new Date( 1970, parseInt( number ) - 1, 1 );
    return date.toLocaleString( vscode.env.language, { month: "long" } );
}

var getDay = function( date )
{
    function nth( n ) { return [ "st", "nd", "rd" ][ ( ( n + 90 ) % 100 - 10 ) % 10 - 1 ] || "th" }

    return date.toLocaleString( vscode.env.language, { weekday: 'long' } ) + ' ' + date.getDate() + nth( date.getDate() );
}

var buildCounter = 1;
var usedHashes = {};

function hash( text )
{
    var hash = 0;
    if( text.length === 0 )
    {
        return hash;
    }
    for( var i = 0; i < text.length; i++ )
    {
        var char = text.charCodeAt( i );
        hash = ( ( hash << 5 ) - hash ) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    hash = Math.abs( hash ) % 1000000;

    while( usedHashes[ hash ] !== undefined )
    {
        hash++;
    }

    usedHashes[ hash ] = true;

    return hash;
}

class JournalDataProvider
{
    constructor( _context, outputChannel )
    {
        this._context = _context;
        this.outputChannel = outputChannel;

        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    debug( text )
    {
        this.outputChannel && this.outputChannel.appendLine( text );
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

        treeItem.id = element.id;

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        if( element.file )
        {
            treeItem.resourceUri = new vscode.Uri.file( element.file );
        }

        if( element.type === PATH )
        {
            treeItem.collapsibleState = vscode.workspace.getConfiguration( 'vscode-journal-view' ).expanded ?
                vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
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
        this.debug( "clear" );
        usedHashes = {};
        elements = [];
    }

    add( rootFolder, entryPath )
    {
        var isNote = noteRegex.test( entryPath );
        var isEntry = entryRegex.test( entryPath );

        if( !isNote && !isEntry )
        {
            return;
        }

        var today = new Date().toISOString().substr( 0, 10 ).replace( /\-/g, path.sep ) + getExt();

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
            day = twoDigits( dayNumber ) + getExt();
            parts[ parts.length - 2 ] = day;
            note = parts.pop();
        }

        var dayName = getDay( new Date( parseInt( parts[ 0 ] ), parseInt( parts[ 1 ] ) - 1, dayNumber ) );

        var pathElement;

        var entryElement = {
            type: isNote ? NOTE : ENTRY,
            name: isNote ? note : day,
            file: fullPath,
            id: ( buildCounter * 1000000 ) + hash( fullPath ),
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
                var displayName = p;
                if( level === 1 )
                {
                    displayName = getMonth( p );
                } else if( level > 1 && isNote )
                {
                    displayName = dayName;
                }
                var subPath = path.join( rootFolder, parts.slice( 0, level + 1 ).join( path.sep ) );
                pathElement = {
                    type: PATH,
                    file: subPath,
                    name: p,
                    displayName: displayName,
                    parent: pathElement,
                    elements: [],
                    id: ( buildCounter * 1000000 ) + hash( subPath ),
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
            if( isEntry )
            {
                entryElement.displayName = dayName;
            }
            else
            {
                entryElement.displayName = path.basename( entryElement.name, getExt() ).replace( /_/g, ' ' );
            }

            this.debug( "add: " + JSON.stringify( entryElement ) );

            entryElement.parent = pathElement;

            pathElement.elements.push( entryElement );
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
            if( level === 2 && !p.endsWith( getExt() ) )
            {
                child = parent.find( findSubPath, p + getExt() );
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
            if( level === 2 && !part.endsWith( getExt() ) )
            {
                part += getExt();
            }
            element = element.elements ? element.elements.find( findSubPath, part ) : undefined;
        }

        return found;
    }

    rebuild()
    {
        this.debug( "rebuild" );
        usedHashes = {};
        buildCounter = ( buildCounter + 1 ) % 100;
    }

    refresh()
    {
        this.debug( "refresh" );
        this._onDidChangeTreeData.fire();
        vscode.commands.executeCommand( 'setContext', 'journal-tree-has-content', elements.length > 0 );
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

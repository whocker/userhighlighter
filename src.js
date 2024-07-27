//<nowiki>
/**
 * User highlighter 4.1
 * ---------------------
 * A jQuery/mediawiki-heavy rewrite of [[User:Amalthea/userhighlighter.js]]
 * 
 * This script highlights links to admins' userpages or talkpages in bodyContent
 * (that is, everything but the tabs, personal links at the top of the screen and sidebar)
 * by giving them a gold background. It also colors links to userpages of users with lower
 * and higher-ranked permissions
 *
 * See [[User:Theopolisme/Scripts/adminhighlighter]] for more details.
 *
 * Version 4.0 includes modifications that add tooltips to highlighted users.
 * 4.1 adds caching and replaces all previous source files with a just two files.
 *
 * @author theopolisme
 * @author Bellezzasolo
 * @author Amorymeltzer
 * @author Pythoncoder
 * @author Chlod
 */
(function($, mw) {
mw.hook('wikipage.content').add(async function() {
    // Declare group enum
    const groups = {
        arbcom:        "+",
        autopatrolled:     "a",
        bureaucrat:        "b",
        checkuser:         "c",
        extendedconfirmed: "e",
        filemover:         "f",
        interfaceadmin:    "i",
        extendedmover:     "m",
        suppress:          "o",
        patroller:         "p",
        rollbacker:        "r",
        templateeditor:    "t",
        reviewer:          "v",
        sysop:             "s",
    };

    // i18n?
    const lang = {
        load_err: "An error occurred while loading UserHighlighter.",
        load_err_report: "Please report this to <https://en.wikipedia.org/wiki/User_talk:Chlod>."
    };

    // Open IDB connection
    const idbConnectionRequest = indexedDB.open("userhighlighter", 1);

    idbConnectionRequest.onupgradeneeded = function (event) {
        const db = idbConnectionRequest.result;
        db.createObjectStore("main", {keyPath: "key"});
    };

    await new Promise((res, rej) => {
        idbConnectionRequest.onsuccess = res;
        idbConnectionRequest.onerror = rej;
    }).catch((error) => {
        console.error(`${lang.load_err} ${lang.load_err_report}`, error);
        mw.notify(load_err);
        return;
    });

    const db = idbConnectionRequest.result;
    const transaction = db.transaction("main", "readonly");

    // Helpers
    async function dbGet(store, key) {
        return new Promise((res, rej) => {
            const get = transaction.objectStore(store).get(key);
            get.onsuccess = () => { res(get.result); };
            get.onerror = rej;
        });
    }
    async function dbPut(store, object) {
        return new Promise((res, rej) => {
            const put = db.transaction("main", "readwrite")
                .objectStore(store).put(object);
            put.onsuccess = () => { res(true); };
            put.onerror = rej;
        });
    }

    let users = null;
    const lastPull = await dbGet("main", "lastPull");
    if (
        lastPull == undefined 
        || Date.now() - lastPull.value > (window.ADMINHIGHLIGHT_INTERVAL || 86400000) // 1 day
    ) {
        console.log("[UH] Redownloading...");
        const updatedList = {};
        // Grab all groups except extended-confirmed
        const groupRequest = JSON.parse((await (await fetch(
            mw.config.get("wgScriptPath") 
                + "/index.php?"
                + "action=raw"
                + "&ctype=application/js"
                + "&title=User:MDanielsBot/markAdmins-Data.js"
        )).text())
            .trim()
            .replace(/\);/g, "")
            .replace(/mw.hook\(.+?\)\.fire\(/, ""));

        for (const [user, userGroups] of Object.entries(groupRequest)) {
            let groupString = "";
            
            if (userGroups.includes("arbcom"))
                groupString += groups.arbcom;
            if (userGroups.includes("autoreviewer"))
                groupString += groups.autopatrolled;
            if (userGroups.includes("bureaucrat"))
                groupString += groups.bureaucrat;
            if (userGroups.includes("checkuser"))
                groupString += groups.checkuser;
            if (userGroups.includes("filemover"))
                groupString += groups.filemover;
            if (userGroups.includes("interface-admin"))
                groupString += groups.interfaceadmin;
            if (userGroups.includes("extendedmover"))
                groupString += groups.extendedmover;
            if (userGroups.includes("suppress"))
                groupString += groups.suppress;
            if (userGroups.includes("patroller"))
                groupString += groups.patroller;
            if (userGroups.includes("rollbacker") || userGroups.includes("global-rollbacker"))
                groupString += groups.rollbacker;
            if (userGroups.includes("templateeditor"))
                groupString += groups.templateeditor;
            if (userGroups.includes("reviewer"))
                groupString += groups.reviewer;
            if (userGroups.includes("sysop"))
                groupString += groups.sysop;

            updatedList[user] = groupString;
        }

        // Grab extended confirmed
        const xconRequest = await (await fetch(
            mw.config.get("wgScriptPath") 
                + "/index.php?"
                + "action=raw"
                + "&ctype=application/js"
                + "&title=User:Chlod/Scripts/UserHighlighter/excon.json"
        )).json();
        for (const user of xconRequest) {
            if (updatedList[user] == null)
                updatedList[user] = groups.extendedconfirmed;
            else
                updatedList[user] += groups.extendedconfirmed;
        }

        // PUSH
        dbPut("main", {
            key: "users",
            users: updatedList
        }).then(() => {
            dbPut("main", { key: "lastPull", value: Date.now()});
        });

        users = updatedList;
    } else {
        users = (await dbGet("main", "users")).users;
    }

    ADMINHIGHLIGHT_EXTLINKS = window.ADMINHIGHLIGHT_EXTLINKS || false;
    ADMINHIGHLIGHT_NAMESPACES = [-1,2,3];

    mw.loader.using(['mediawiki.util','mediawiki.Uri', 'mediawiki.Title'], function() {
        mw.util.addCSS("[class~=userhighlighter_excon] {background-color: #4CFF4B}");
        mw.util.addCSS("[class~=userhighlighter_pcusr] {background-color: #FFECBE}");
        mw.util.addCSS("[class~=userhighlighter_rbckr] {background-color: #FFECBE}");
        mw.util.addCSS("[class~=userhighlighter_ptusr] {background-color: #FFECBE}");
        mw.util.addCSS("[class~=userhighlighter_pgmvr],[class~=userhighlighter_flmvr] {background-color: #FFEF00}");
        mw.util.addCSS("[class~=userhighlighter_temop] {background-color: #FFEF00}");
        mw.util.addCSS("[class~=userhighlighter_sysop] {background-color: #8CF1FF}");
        mw.util.addCSS("[class~=userhighlighter_interface-admin][class~=userhighlighter_sysop] {background-color: #8CF1FF}");
        mw.util.addCSS("[class~=userhighlighter_checkuser][class~=userhighlighter_sysop] {background-color: #63FFCB}");
        mw.util.addCSS("[class~=userhighlighter_suppress][class~=userhighlighter_sysop] {background-color: #63FFCB}");
        mw.util.addCSS("[class~=userhighlighter_arbcom][class~=userhighlighter_sysop] {background-color: #63FFCB}");
        mw.util.addCSS("[class~=userhighlighter_bureaucrat][class~=userhighlighter_sysop] {background-color: #E2B1FF}");
        mw.util.addCSS("[class~=userhighlighter_steward] {background-color: #FFA8A8}");
        $('#article a, #bodyContent a, #mw_contentholder a').each(function(index,linkraw){
            try {
                var link = $(linkraw);
                var url = link.attr('href');
                if (!url || url.charAt(0) === '#') return; // Skip <a> elements that aren't actually links; skip anchors
                if (url.lastIndexOf("http://", 0) !== 0 && url.lastIndexOf("https://", 0) !== 0 && url.lastIndexOf("/", 0) !== 0) return; //require http(s) links, avoid "javascript:..." etc. which mw.Uri does not support
                if (link.hasClass('ext-discussiontools-init-timestamplink')) return; // skip discussiontools timestamps
                var uri = new mw.Uri(url);
                if (!ADMINHIGHLIGHT_EXTLINKS && !$.isEmptyObject(uri.query)) return; // Skip links with query strings if highlighting external links is disabled
                if (uri.host == 'en.wikipedia.org') {
                    var mwtitle = new mw.Title(mw.util.getParamValue('title',url) || decodeURIComponent(uri.path.slice(6))); // Try to get the title parameter of URL; if not available, remove '/wiki/' and use that
                    if ($.inArray(mwtitle.getNamespaceId(), ADMINHIGHLIGHT_NAMESPACES)>=0) {
                        var user = mwtitle.getMain().replace(/_/g," ");
                        if (mwtitle.getNamespaceId() === -1) user = user.replace('Contributions/',''); // For special page "Contributions/<username>"
                        if (mwtitle.getNamespaceId() === -1) user = user.replace('Contribs/',''); // The Contribs abbreviation too
                        
                        var usergroups = users[user];
                        if (usergroups == null)
                            return;
                        var usergroupNames = [];
                        if (usergroups.includes(groups.steward)) {
                            link.addClass(link.attr('class') + ' userhighlighter_steward');
                            usergroupNames.push("steward");
                        }
                        if(usergroups.includes(groups.bureaucrat)) {
                            link.addClass(link.attr('class') + ' userhighlighter_bureaucrat');
                            usergroupNames.push("bureaucrat");
                        }
                        if(usergroups.includes(groups.arbcom)) {
                            link.addClass(link.attr('class') + ' userhighlighter_arbcom');
                            usergroupNames.push("Arbitration Committee member");
                        }
                        if(usergroups.includes(groups.suppress)) {
                            link.addClass(link.attr('class') + ' userhighlighter_suppress');
                            usergroupNames.push("oversighter");
                        }
                        if(usergroups.includes(groups.checkuser)) {
                            link.addClass(link.attr('class') + ' userhighlighter_checkuser');
                            usergroupNames.push("checkuser");
                        }
                        if(usergroups.includes(groups.interfaceadmin)) {
                            link.addClass(link.attr('class') + ' userhighlighter_interface-admin');
                            usergroupNames.push("interface administrator");
                        }
                        if (usergroups.includes(groups.sysop)) {
                            link.addClass(link.attr('class') + ' userhighlighter_sysop');
                            usergroupNames.push("administrator");
                        }
                        if(usergroups.includes(groups.templateeditor)) {
                            link.addClass(link.attr('class') + " userhighlighter_temop"); 
                            usergroupNames.push("template editor");
                        }
                        if(usergroups.includes(groups.extendedmover)) {
                            link.addClass(link.attr('class') + " userhighlighter_pgmvr"); 
                            usergroupNames.push("page mover");
                        }
                        if(usergroups.includes(groups.filemover)) {
                            link.addClass(link.attr('class') + " userhighlighter_flmvr");
                            usergroupNames.push("file mover");
                        }
                        if(usergroups.includes(groups.patroller)) {
                            link.addClass(link.attr('class') + " userhighlighter_ptusr");
                            usergroupNames.push("patroller");
                        }
                        if(usergroups.includes(groups.rollbacker)) {
                            link.addClass(link.attr('class') + " userhighlighter_rbckr"); 
                            usergroupNames.push("rollbacker");
                        }
                        if(usergroups.includes(groups.reviewer)) {
                            link.addClass(link.attr('class') + " userhighlighter_pcusr"); 
                            usergroupNames.push("pending changes reviewer");
                        }
                        if(usergroups.includes(groups.extendedconfirmed)) {
                            link.addClass(link.attr('class') + " userhighlighter_excon"); 
                            usergroupNames.push("extended confirmed");
                        }
                        if (usergroupNames.length > 0) {
                        	var merged = usergroupNames.join(", ");
                        	var link_title = link.attr("title");
                        	link.attr(
                        		"title",
                        		(link_title != null ? link_title + "\n" : "") 
                        			+ merged[0].toUpperCase() + merged.substring(1)
                			);
                        }
                    }
                }
            } catch (e) {
                // Sometimes we will run into unparsable links, so just log these and move on
                console.error('[UH] Recoverable error', e);
            }
        });
    });
});
}(jQuery, mediaWiki));
// </nowiki>

// ==UserScript==
// @name         crathighlighter
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Highlight crat actions on Wikipedia with additional perms
// @author       Amorymeltzer
// @match        *://*.wikipedia.org/*
// @grant        none
// ==/UserScript==

(function($) {
    var highlight_order = window.highlight_order || [
        'arbcom', 'bureaucrat', 'oversight', 'checkuser', 'interface-admin', 
        'sysop', 'steward', 'exsysop', '10k', '500', 'pagemover', 'templater', 
        'patroller', 'rollbacker'
    ];
    var all_groups = window.all_groups || false;
    if (all_groups) {
        highlight_order.reverse();
    }

    // Core function for applying classes to the parsed JSON data
    var main = function(data) {
        var ADMINHIGHLIGHT_EXTLINKS = window.ADMINHIGHLIGHT_EXTLINKS || false;
        var ADMINHIGHLIGHT_NAMESPACES = [-1, 2, 3];
        var classDefs = {
            'arbcom': '888888',
            'bureaucrat': '5588FF',
            'oversight': 'DD66DD',
            'checkuser': 'FFFF00',
            'interface-admin': '66DD66',
            'sysop': '00FFFF',
            'steward': 'FF9933',
            'exsysop': 'FF0000',
            '10k': 'FF66CC',
            '500': 'FFCC00',
            'pagemover': '00CC00',
            'templater': '6600CC',
            'patroller': 'FF6699',
            'rollbacker': '33CC33'
        };

        mw.loader.using(['mediawiki.util', 'mediawiki.Uri', 'mediawiki.Title'], function() {
            for (var perm in highlight_order) {
                mw.util.addCSS('.userhighlighter_' + highlight_order[perm] + ' {background-color: #' + classDefs[highlight_order[perm]] + '}');
            }

            $('#mw-content-text a').each(function(index, linkraw) {
                try {
                    var link = $(linkraw);
                    var url = link.attr('href');
                    if (!url || url === '/wiki/' || url.charAt(0) === '#') {
                        return;
                    } // Skip <a> elements that aren't actually links; skip anchors
                    if (url.lastIndexOf('http://', 0) !== 0 && url.lastIndexOf('https://', 0) !== 0 && url.lastIndexOf('/', 0) !== 0) {
                        return;
                    } // require http(s) links, avoid "javascript:..." etc. which mw.Uri does not support
                    if (link[0].parentElement.className && link[0].parentElement.classList[0] === 'autocomment') {
                        return;
                    } // Skip span.autocomment links aka automatic section links in edit summaries
                    if (link[0].tagName === 'IMG') {
                        return;
                    } // Don't highlight image links or talk page discussion tools links
                    if (link[0].className && (link[0].classList[0] === 'external' || link[0].classList[0] === 'ext-discussiontools-init-timestamplink')) {
                        return;
                    } // Avoid errors on hard-to-parse external links
                    url = url.replace(/%(?![0-9a-fA-F][0-9a-fA-F])/g, '%25');
                    var uri = new mw.Uri(url);
                    if (!ADMINHIGHLIGHT_EXTLINKS && !$.isEmptyObject(uri.query)) {
                        return;
                    } // Skip links with query strings if highlighting external links is disabled
                    if (uri.host === 'en.wikipedia.org') {
                        var mwtitle = new mw.Title(mw.util.getParamValue('title', url) || decodeURIComponent(uri.path.slice(6))); // Try to get the title parameter of URL; if not available, remove '/wiki/' and use that
                        if ($.inArray(mwtitle.getNamespaceId(), ADMINHIGHLIGHT_NAMESPACES) >= 0) {
                            var user = mwtitle.getMain().replace(/_/g, ' ');
                            if (mwtitle.getNamespaceId() === -1) {
                                user = user.replace('Contributions/', '');
                            }
                            $.each(highlight_order, function(_ix, ug) {
                                if (data[ug] && data[ug][user] === 1) {
                                    link.addClass('userhighlighter_' + ug);
                                    return all_groups; // Exit on first match if false, continue if true
                                }
                            });
                        }
                    }
                } catch (e) {
                    // Sometimes we will run into unparsable links, so just log these and move on
                    mw.log.warn('crathighlighter.js unparsable link', e.message, linkraw);
                }
            });
        });
    };

    // Grab or generate the user data then actually run the main function
    var crathighlighterdata;
    try {
        crathighlighterdata = JSON.parse(localStorage.getItem('crathighlighterjson'));
    } catch (e) {
        mw.log.error('crathighlighter: failed to parse local storage', e.message);
    }
    var cache_len = window.cache_hours || 1;
    cache_len *= 60 * 60 * 1000; // milliseconds
    if (!crathighlighterdata || !crathighlighterdata.date || (Date.now() - new Date(crathighlighterdata.date).getTime()) > cache_len) {
        crathighlighterdata = {};
        var promises = [];
        var baseUrls = {
            'arbcom': '/w/index.php?action=raw&ctype=application/json&title=User:AmoryBot/crathighlighter.js/arbcom.json',
            'bureaucrat': '/w/index.php?action=raw&ctype=application/json&title=User:AmoryBot/crathighlighter.js/bureaucrat.json',
            'oversight': '/w/index.php?action=raw&ctype=application/json&title=User:AmoryBot/crathighlighter.js/oversight.json',
            'checkuser': '/w/index.php?action=raw&ctype=application/json&title=User:AmoryBot/crathighlighter.js/checkuser.json',
            'interface-admin': '/w/index.php?action=raw&ctype=application/json&title=User:AmoryBot/crathighlighter.js/interface-admin.json',
            'sysop': '/w/index.php?action=raw&ctype=application/json&title=User:AmoryBot/crathighlighter.js/sysop.json',
            'steward': '/w/index.php?action=raw&ctype=application/json&title=User:AmoryBot/crathighlighter.js/steward.json',
            'exsysop': '/w/index.php?action=raw&ctype=application/json&title=User:OtherSource/exsysop.json',
            '10k': '/w/index.php?action=raw&ctype=application/json&title=User:OtherSource/10k.json',
            '500': '/w/index.php?action=raw&ctype=application/json&title=User:OtherSource/500.json',
            'pagemover': '/w/index.php?action=raw&ctype=application/json&title=User:OtherSource/pagemover.json',
            'templater': '/w/index.php?action=raw&ctype=application/json&title=User:OtherSource/templater.json',
            'patroller': '/w/index.php?action=raw&ctype=application/json&title=User:OtherSource/patroller.json',
            'rollbacker': '/w/index.php?action=raw&ctype=application/json&title=User:OtherSource/rollbacker.json'
        };

        $.each(highlight_order, function(idx, perm) {
            var url = baseUrls[perm];
            var deferred = $.getJSON(url, function(data) {
                crathighlighterdata[perm] = data;
            });
            promises.push(deferred);
        });

        $.when.apply(null, promises).then(function() {
            crathighlighterdata.date = Date.now();
            localStorage.setItem('crathighlighterjson', JSON.stringify(crathighlighterdata));
            main(crathighlighterdata);
        });
    } else {
        main(crathighlighterdata);
    }
})(jQuery);

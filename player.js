/**
 * (C) Copyright 2012, 2013, 2014 Scott Jaderholm
 *
 * Use, modification, and distribution are subject to the terms
 * specified in the LICENSE file.

 * Description: Conkeror page-mode for controlling media players on
 * websites like Youtube, Grooveshark, etc.

**/

require("content-buffer.js");

define_keymap("player_keymap", $display_name = "player");

var player_click_element = function(I, selector, error_message) {
    var elem = I.buffer.document.querySelector(selector);
    if (elem) {
        dom_node_click(elem, 1, 1);
    } else {
        I.minibuffer.message(error_message);
    }
};

var player_command = function(command, error_message) {
    return function (I) {
        var site = player_get_current_site(I);
        if (site) {
            var selector = player_button_selectors[site][command];
            if (selector) {
                if (selector instanceof Function) {
                    selector(I);
                } else {
                    player_click_element(I, selector, error_message);
                }
            } else {
                I.minibuffer.message("Command not implemented for this site.");
            }
        } else {
            I.minibuffer.message("Current url not recognized as a supported site.");
        }
    };
};

// test with:
// get_recent_conkeror_window().buffers.current.page.local.player_current_site
define_variable("player_current_site", null,
    "Name of the current site used to look up things like button ids.");

var player_site_from_url = function(url) {
    for (var site in player_url_tests) {
        var test = player_url_tests[site];
        if (test instanceof RegExp) {
            if (test.exec(url)) {
                return site;
            }
        } else if ((test instanceof Function) && (test(url))) {
            return site;
        }
    }
    return null;
};

var player_get_current_site = function(I) {
    var local = I.buffer.page.local;
    var uri = I.buffer.current_uri;
    if (local.player_current_site == null) {
        local.player_current_site = player_site_from_url(uri.spec);
    }
    return local.player_current_site;
};

// Map of site names to regexes or functions that match their url
// Ex: {"bandcamp": /bandcamp\.com/}
var player_url_tests = {};

// Map of site names to a map of commands to selectors/functions
// Ex: {"bandcamp": {"play": ".play-btn"}}
var player_button_selectors = {};

interactive("player-play-or-pause",
            "Click the play/pause button.",
            player_command("play",
                           "No play or pause button found"));

interactive("player-mute",
            "Click the mute button.",
            player_command("mute",
                           "No mute button found"));

interactive("player-previous",
            "Click the previous button.",
            player_command("previous",
                           "No previous button found"));

interactive("player-next",
            "Click the next button.",
            player_command("next",
                           "No next button found"));

interactive("player-fullscreen",
            "Click the fullscreen button.",
            player_command("fullscreen",
                           "No fullscreen button found"));

define_key(player_keymap, "C-c C-return", "player-play-or-pause");
define_key(player_keymap, "C-c C-m", "player-mute");
define_key(player_keymap, "C-c C-n", "player-next");
define_key(player_keymap, "C-c C-p", "player-previous");
define_key(player_keymap, "C-c C-f", "player-fullscreen");

define_keymaps_page_mode("player-mode",
    [],
    { normal: player_keymap },
    $display_name = "Player");


var def_player_site = function (site_name, site_url, button_selectors) {
    player_url_tests[site_name] = site_url;
    player_button_selectors[site_name] = button_selectors;
    player_mode.test.push(player_url_tests[site_name]);
};

/* ------------------------------
   8tracks
   Test url: http://8tracks.com/moose92/suits-stetsons
   ------------------------------ */

def_player_site("8tracks",
                build_url_regexp($domain = "8tracks", $allow_www = true),
                {"play": ".i-play, .i-pause",
                 "next": ".i-skip",
                 "mute": ".volume-mute"});

/* ------------------------------
   Amazon CloudPlayer and MP3 Store
   Test url: https://www.amazon.com/gp/dmusic/mp3/player
   Test url: http://www.amazon.com/Cove-Weather/dp/B001D5796O/
   ------------------------------ */

def_player_site("amazon-cloudplayer",
                build_url_regexp($domain = "amazon", $allow_www = true),
                {"play": ".a-icon-play-all, .a-icon-pause-all, .mp3MasterPlay",
                 "previous": ".mp3PlayPrevious",
                 "next": ".mp3PlayNext",
                 "mute": player_amazon_mute});

function player_amazon_mute(I) {
    var elem = I.buffer.document.querySelector(".volumeControl .ui-slider-range");
    if (elem && elem.style.width == "0%") {
        player_click_element(I, "#fullVolume",
                             "No 'full volume' button found");
    }
    else {
        player_click_element(I, "#noVolume",
                             "No 'no volume' button found");
    }
}

/* ------------------------------
   Bandcamp
   Test url: http://sabzi.bandcamp.com/album/rainier
   ------------------------------ */

def_player_site("bandcamp",
                /bandcamp\.com/,
                {"play": ".playbutton, .play-btn",
                 "previous": ".prevbutton",
                 "next": ".nextbutton"});

/* ------------------------------
   Grooveshark
   Test url: http://grooveshark.com/#!/album/Cove/1545589
   ------------------------------ */

def_player_site("grooveshark",
                build_url_regexp($domain = "grooveshark", $allow_www = true),
                {"play": "#play-pause",
                 "mute": "#volume",
                 "previous": "#play-prev",
                 "next": "#play-next"});

/* ------------------------------
   Last.fm
   Test url: http://www.last.fm/listen/artist/GodWolf/similarartists
 ------------------------------ */
function player_lastfm_play(I) {
    var elem = I.buffer.document.querySelector("#radioControlPlay");
    if (elem && elem.offsetHeight == 0) {
        player_click_element(I, "#radioControlPause",
                             "No pause button found");
    }
    else {
        player_click_element(I, "#radioControlPlay",
                             "No play button found");
    }
}

def_player_site("lastfm",
                /last\.fm/,
                {"play": player_lastfm_play,
                 // mute doesn't work yet because it is in an iframe
                 // "mute": ".ytp-button-volume",
                 "next": "#radioControlSkip"});

/* ------------------------------
   Pandora
   ------------------------------ */

def_player_site("pandora",
                build_url_regexp($domain = "pandora", $allow_www = true),
                {"next": ".skipButton",
                 "play": player_pandora_play,
                 "mute": player_pandora_mute});

function player_pandora_play_button_is_visible (I) {
    var elem = I.buffer.document.querySelector(".playButton");
    return (elem && elem.style.display !== "none");
}

function player_pandora_play (I) {
    if (pandora_play_button_is_visible(I)) {
        player_click_element(I, ".playButton",
                             "No play button found");
    }else {
        player_click_element(I, ".pauseButton",
                             "No pause button found");
    }
}

// TODO Unmute doesn't work, I couldn't figure out how to unmute
// manually via JS even in Chrome Console
function player_pandora_mute (I) {
    var knob = I.buffer.document.querySelector(".volumeKnob");
    var clicker = I.buffer.document.querySelector(".volumeBar");
    if (knob && knob.style.left == "20.00px") {
        dom_node_click(clicker, 146, 1);
    } else {
        dom_node_click(clicker, 64, 1);
    }
}

/* ------------------------------
   rdio
   Test url: http://www.rdio.com/
   ------------------------------ */

def_player_site("rdio",
                build_url_regexp($domain = "rdio", $allow_www = true),
                {"play": ".play_pause",
                 "mute": ".Volume",
                 "previous": ".prev",
                 "next": ".next"});

/* ------------------------------
   SoundCloud
   Test url: https://soundcloud.com/perabhjot-grewal
   ------------------------------ */

def_player_site("soundcloud",
                build_url_regexp($domain = "soundcloud", $allow_www = true),
                {"play": ".playing, .playButton",
                 "mute": ".volume__togglemute",
                 "previous": ".prevbutton, .skipControl__previous",
                 "next": ".nextbutton, .skipControl__next"});

/* ------------------------------
   Twitter Music
   Test url: https://music.twitter.com/i/chart/popular
   ------------------------------ */

def_player_site("twitter",
                build_url_regexp($domain = "music.twitter"),
                {"play": ".player-play-pause",
                 "next": ".player-next"});

/* ------------------------------
   Youtube HTML5 Player
   Test url: http://www.youtube.com/watch?v=pPWcX-16A9Y
   ------------------------------ */

def_player_site("youtube-html5",
                build_url_regexp($domain = "youtube", $allow_www = true),
                {"play": ".ytp-button-pause, .ytp-button-play, .ytp-button-replay",
                 "mute": ".ytp-button-volume",
                 "fullscreen": ".ytp-button-fullscreen-enter, .ytp-button-fullscreen-exit"});

page_mode_activate(player_mode);

provide("player");


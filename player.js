/**
 * (C) Copyright 2012-2016 Scott Jaderholm
 *
 * Use, modification, and distribution are subject to the terms
 * specified in the LICENSE file.

 * Description: Conkeror page-mode for controlling media players on
 * websites like Youtube, Grooveshark, etc.

**/

require("content-buffer.js");

define_keymap("player_keymap", $display_name = "player");

function player_click_element(I, elem, error_message) {
    if (elem) {
        dom_node_click(elem, 1, 1);
        player_last_use_record(I);
    } else {
        I.minibuffer.message(error_message);
    }
};

function player_click_selector(I, selector, error_message) {
    var elem = I.buffer.document.querySelector(selector);
    player_click_element(I, elem, error_message);
}

var player_last_use_context;

function player_last_use_record(I) {
    player_last_use_context = I;
    I.buffer.document.player_used = true;
}

function player_last_use_available() {
    return player_last_use_context &&
        player_last_use_context.buffer &&
        !player_last_use_context.buffer.dead &&
        player_last_use_context.buffer.document &&
        player_last_use_context.buffer.document.player_used
};

interactive("player-last", "Run the next command on the last used buffer",
            function (I) {
                I.player_use_last = true;
            }, $prefix);

function player_command_last_use(command, error_message) {
    player_command(command, error_message)(player_last_use_context);
};

function player_command(command, error_message) {
    return function (I) {
        if(I.player_use_last) {
            return player_command_last_use(command, error_message);
        }
        var site = player_get_current_site(I);
        if (site) {
            var selector = player_button_selectors[site][command];
            if (selector) {
                if (selector instanceof Function) {
                    // the function might click the element itself, or
                    // might return an element to be clicked
                    var elem = selector(I);
                    if (elem instanceof Ci.nsIDOMHTMLElement) {
                        player_click_element(I, elem, error_message);
                    } else {
                        player_last_use_record(I);
                    }
                } else {
                    player_click_selector(I, selector, error_message);
                }
            } else {
                I.minibuffer.message("Command not implemented for this site.");
            }
        }
        else if (player_last_use_available()) {
            player_command_last_use(command, error_message);
        }
        else {
            I.minibuffer.message("Current url not recognized as a supported site.");
        }
    };
};

// test with:
// get_recent_conkeror_window().buffers.current.page.local.player_current_site
define_variable("player_current_site", null,
    "Name of the current site used to look up things like button ids.");

function player_site_from_url(url) {
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

function player_get_current_site(I) {
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

interactive("player-play",
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

define_key(player_keymap, "C-c C-return", "player-play");
define_key(player_keymap, "C-c C-m", "player-mute");
define_key(player_keymap, "C-c C-n", "player-next");
define_key(player_keymap, "C-c C-p", "player-previous");
define_key(player_keymap, "C-c C-f", "player-fullscreen");
define_key(player_keymap, "C-c C-l", "player-last");

define_keymaps_page_mode("player-mode",
    [],
    { normal: player_keymap },
    $display_name = "Player");


function def_player_site(site_name, site_url, button_selectors) {
    player_url_tests[site_name] = site_url;
    player_button_selectors[site_name] = button_selectors;
    player_mode.test.push(player_url_tests[site_name]);
};

/* ------------------------------
   Helpers
   ------------------------------ */
function player_play_function_visibility(playButtonSelector,pauseButtonSelector) {
    return function (I) {
        var elem = I.buffer.document.querySelector(playButtonSelector);
        if (elem && elem.style.display !== "none") {
            player_click_selector(I, playButtonSelector,
                                 "No play button found");
        } else {
            player_click_selector(I, pauseButtonSelector,
                                 "No pause button found");
        }
    };
};

function player_iframe_button(iframe_selector, button_selector) {
    return function (I) {
        var player_iframe = I.buffer.document.querySelector(iframe_selector).contentDocument;
        var elem = player_iframe.querySelector(button_selector);
        return elem;
    }
}

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
                 "next": ".mp3PlayNext, .a-icon-play-next",
                 "mute": player_amazon_mute});

function player_amazon_mute(I) {
    var elem = I.buffer.document.querySelector(".volumeControl .ui-slider-range");
    if (elem && elem.style.width == "0%") {
        player_click_selector(I, "#fullVolume",
                             "No 'full volume' button found");
    }
    else {
        player_click_selector(I, "#noVolume",
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
   Google Music
   Test url: http://grooveshark.com/#!/album/Cove/1545589
   ------------------------------ */

def_player_site("google-music",
                build_url_regexp($domain = "play.google", $allow_www = true),
                {"play": "[data-id=play-pause]",
                 "next": "[data-id=forward]",
                 "previous": "[data-id=rewind]"});

/* ------------------------------
   Grooveshark
   Test url: http://grooveshark.com/#!/album/Cove/1545589
   ------------------------------ */

def_player_site("grooveshark",
                build_url_regexp($domain = "grooveshark", $allow_www = true),
                {"play": "#play-pause",
                 "mute": "#volume",
                 "previous": "#play-prev",
                 "next": "#play-next",
                 "artist": "TODO.now-playing-link.artist",
                 "song": "TODO.now-playing-link.song",
                 "time-percent": "TODO#elapsed.style.width",
                 "time-position": "TODO#time-elapsed",
                 "time-total": "TODO#time-total"});

/* ------------------------------
   Hype Machine
   Test url: http://hypem.com
   ------------------------------ */

def_player_site("hypemachine",
                build_url_regexp($domain = "hypem", $allow_www = true),
                {"play": "#playerPlay",
                 "mute": "#player-volume-mute",
                 "previous": "#playerPrev",
                 "next": "#playerNext",
                 "artist": "TODO#player-nowplaying a(first)",
                 "song": "TODO#player-nowplaying a(second)",
                 "time-percent": "TODO#player-progress-playing.style.width",
                 "time-position": "TODO#player-time-position",
                 "time-total": "TODO#player-time-total"});

/* ------------------------------
   Indieshuffle
   Test url: http://www.indieshuffle.com/
   ------------------------------ */

def_player_site("indieshuffle",
                build_url_regexp($domain = "indieshuffle", $allow_www = true),
                {"play": "#currentSong .commontrack",
                 "previous": "#playlistContainer .commontrack.previous",
                 "next": "#playNextSong"});

/* ------------------------------
   Jamendo
   Test url: http://www.jamendo.com/en/search/discover?qs=q=*:*&by=rating
   ------------------------------ */

def_player_site("jamendo",
                build_url_regexp($domain = "jamendo", $allow_www = true),
                {"play": player_play_function_visibility(".playpause.play",".playpause.pause"),
                 "next": ".nexttrack",
                "previous": ".prevtrack"});

/* ------------------------------
   Last.fm
   Test url: http://www.last.fm/listen/artist/GodWolf/similarartists
 ------------------------------ */
function player_lastfm_play(I) {
    var elem = I.buffer.document.querySelector("#radioControlPlay");
    if (elem && elem.offsetHeight == 0) {
        player_click_selector(I, "#radioControlPause",
                             "No pause button found");
    }
    else {
        player_click_selector(I, "#radioControlPlay",
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
                 "play": player_play_function_visibility(".playButton",".pauseButton"),
                 "mute": player_pandora_mute});

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
   songza
   Test url: http://songza.com/concierge/today-s-indie/5230959f5325bf29cd4d4423/5230e24f311e171fa6f2087c/
   ------------------------------ */

def_player_site("songza",
                build_url_regexp($domain = "songza", $allow_www = true),
                {"play": ".miniplayer-control-play-pause, .ui-icon-ios7-play",
                 "mute": ".miniplayer-volume-icon",
                 "next": ".miniplayer-control-skip"});

/* ------------------------------
   SoundCloud
   Test url: https://soundcloud.com/perabhjot-grewal
   ------------------------------ */

def_player_site("soundcloud",
                build_url_regexp($domain = "soundcloud", $allow_www = true),
                {"play": ".playControl, .playButton",
                 "mute": ".volume__togglemute",
                 "previous": ".prevbutton, .skipControl__previous",
                 "next": ".nextbutton, .skipControl__next"});

/* ------------------------------
   spotify
   Test url: https://play.spotify.com/user/spotify/playlist/1C8k4jcNnfiRw2RtO6CByK
   ------------------------------ */

def_player_site("spotify",
                build_url_regexp($domain = "play.spotify"),
                {"play": player_iframe_button("#app-player", "#play-pause"),
                 "previous": player_iframe_button("#app-player", "#previous"),
                 "next": player_iframe_button("#app-player", "#next"),
                 "like": player_iframe_button("#app-player","#track-add:not(.added)")});

// TODO need a dom_node_click that's relative to item setting offsetX/Y.
// Need MouseEvent constructor access from Conkeror for that.
function player_spotify_mute (I) {
    var volume_slider = player_iframe_button("#app-player", "#vol-position")(I);
    if (volume_slider) {
        if (volume_slider.style.left == "0.00px") {
            dom_node_click(volume_slider, 100, 8);
        } else {
            dom_node_click(volume_slider, 10, 8);
        }
    } else {
        I.minibuffer.message("No mute button found");
    }
}

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
   Test for next/prev https://www.youtube.com/playlist?list=PL8O3Xz4bn9o4MFHjue73kS4Um4mpxvJ7p
   ------------------------------ */

def_player_site("youtube-html5",
                build_url_regexp($domain = "youtube", $allow_www = true),
                {"play": ".ytp-play-button, .ytp-button-pause, .ytp-button-play, .ytp-button-replay",
                 "mute": ".ytp-mute-button, .ytp-button-volume",
                 "previous": ".ytp-prev-button, .yt-uix-button.prev-playlist-list-item",
                 "next": ".ytp-next-button, .yt-uix-button.next-playlist-list-item",
                 "fullscreen": ".ytp-fullscreen-button, .ytp-button-fullscreen-enter, .ytp-button-fullscreen-exit"});

page_mode_activate(player_mode);

provide("player.js");

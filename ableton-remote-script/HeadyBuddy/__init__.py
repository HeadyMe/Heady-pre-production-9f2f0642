# © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
# HeadyBuddy — Ableton Live Remote Script
# Bridges Buddy's DAW MCP Bridge (Node.js) ↔ Ableton's Live Object Model (LOM)
#
# Install: Copy this folder to:
#   Mac:  ~/Library/Preferences/Ableton/Live 12/User Remote Scripts/HeadyBuddy/
#   Win:  %APPDATA%\Ableton\Live 12\Preferences\User Remote Scripts\HeadyBuddy\
#
# Then in Ableton: Preferences → Link/Tempo/MIDI → Control Surface → HeadyBuddy

from __future__ import absolute_import
from .HeadyBuddyScript import HeadyBuddyScript


def create_instance(c_instance):
    """Called by Ableton Live to instantiate the control surface."""
    return HeadyBuddyScript(c_instance)

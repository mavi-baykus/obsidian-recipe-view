Timers
======

Recipe view has timers you can keep in view while you cook. You can run several at once.

Adding a timer
**************

Click **Timer** under *Scale recipe*, or run the *Add a timer* command. The new timer is set but not started, so you can change its time first, then click ▶ to start it.

* If the recipe has a ``cook time (hh:mm)`` property, the first timer is set to it and labelled *Cook time*.
* Otherwise, or if there already is a *Cook time* timer, the new timer is set to the last time you started a timer with (10 minutes to begin with).

The cook time can be written in many ways. A plain number is minutes:

.. code-block:: yaml

    cook time (hh:mm): 01:30           # 1 hour 30 minutes
    cook time (hh:mm): 1:30
    cook time (hh:mm): 1 h 30 min      # also 1h 30m, 1hr 30min, 1 hour 30 minutes
    cook time (hh:mm): 45 min          # also 45m, 45 minutes
    cook time (hh:mm): 1.5 h           # also 1,5 saat, 1½ hours
    cook time (hh:mm): 1 saat 15 dakika
    cook time (hh:mm): 90              # 90 minutes
    cook time (hh:mm): PT1H30M         # as copied from recipe websites

The property's name can be changed in the settings. If the time can't be read, a notice says so and the timer uses the last time instead.

Using a timer
*************

* **▶ / ⏸** start and pause the timer.
* **−1, +1, +5** take away or add minutes, whether the timer is running or not.
* Click the time to type a new one, e.g. ``12:00`` (12 minutes, as the timer shows it), ``1:30:00``, ``1h 30m`` or ``90``, then press :kbd:`Enter`.
* **✕** removes the timer, and **+ Timer** adds another.

When a timer finishes it flashes, a notice appears, and it beeps until you dismiss it: click **Dismiss** or the notice, or run *Dismiss timer alarms*. **+1 min** snoozes it. A dismissed timer goes back to its time, ready to start again.

Where timers are shown
**********************

Timers are shown at the top of the ingredients column, or the directions column if set in the settings, and stay there while the column scrolls. In the one-column layout, used on phones and in narrow panes, they stay at the top of the card. The *Timer size* setting makes them smaller or larger.

Timers keep running when you switch languages, edit the note, switch to the note or another recipe, or close the recipe. Every recipe view shows every timer, and timers from another recipe are labelled with its name. On desktop, the status bar shows the next timer to finish.

Timers are saved on each device, so they come back if Obsidian is closed and reopened; one that finished meanwhile rings when Obsidian is back. They aren't shared between devices.

On phones and tablets
*********************

When the screen locks or you switch to another app, iOS and Android pause Obsidian, so an alarm can't sound until you come back to it (the time is still right). To avoid that, Recipe view keeps the screen on while a timer is running or ringing. This can be turned off with *Keep the screen on while a timer runs*.

The *Test the alarm* setting starts a 5 second timer and says whether the screen can be kept on on that device. If the alarm sound can't play, the notice says so.

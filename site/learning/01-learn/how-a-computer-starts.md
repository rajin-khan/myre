# How does a computer start?

Pressing the power button starts a chain of small hand-offs.

1. The firmware checks enough of the hardware to get going.
2. It finds a bootloader on a storage device and starts it.
3. The bootloader loads the Linux kernel into memory.
4. The kernel starts the first system process, which brings up services and eventually a login screen or desktop.

The exact tools and details vary between machines. The useful idea is the hand-off: each part starts the next one.

## Talk it through

- Which part runs before Linux?
- What do you think would happen if the bootloader could not find a kernel?
- Where could we look for clues if a machine stopped during startup?

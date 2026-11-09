# Capturing your iPhone's IRK

Your iPhone changes its Bluetooth address every few minutes. Each new address is built from a secret 16-byte key, the Identity Resolving Key (IRK). Once the bugger has that key, it can check any address it hears and tell whether it came from your phone.

The phone only hands the key to a device it pairs with. So the C3 pretends to be a heart-rate sensor for one minute, the phone pairs, and the C3 saves the key.

## Steps

1. Install ESPHome on your PC: `pip install esphome` (needs 2026.7 or newer for irk-capture).
2. Copy `firmware/secrets.example.yaml` to `firmware/secrets.yaml` and fill in your Wi-Fi.
3. Plug the board in with USB-C and run:

        esphome run firmware/irk-capture.yaml

   If it can't find the port, hold BOOT, tap RST, release BOOT, and run it again.
4. Open `http://irk-capture.local` (or the IP shown in the log).
5. Set **BLE Profile** to **Heart Sensor**.
6. On the iPhone: Settings > Bluetooth, tap **IRK Capture**, accept the pairing.
7. The **IRK** field on the page fills with 32 hex characters. Copy it into `iphone_irk` in `secrets.yaml`.
8. On the iPhone, forget the IRK Capture device.
9. Flash the real firmware:

        esphome run firmware/bugger.yaml

## If it fails

"Failed: IRK not used" means the phone didn't share a key. Forget the device on the phone, turn Bluetooth off and on, press **Refresh BLE Identity** on the page, and pair again.

The key does not change unless you reset the phone's network settings. Keep `secrets.yaml` out of git: anyone with the key can track your phone.

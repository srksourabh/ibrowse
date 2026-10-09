namespace IBrowse.Core;

/// <summary>
/// Decides when a hovered element is spoken: only after the pointer has rested
/// on it for the dwell time, and never again until another element is reached.
/// Moves smaller than the hysteresis radius are jitter and keep the old target.
/// </summary>
public sealed class HoverGate(double dwellMs = 150, double hysteresisPx = 5)
{
    private double anchorX, anchorY, since;
    private string? key;
    private bool spoken;

    public bool Update(double x, double y, string elementKey, double nowMs)
    {
        var moved = key is null || Math.Abs(x - anchorX) >= hysteresisPx || Math.Abs(y - anchorY) >= hysteresisPx;
        if (moved && elementKey != key)
        {
            (anchorX, anchorY, key, since, spoken) = (x, y, elementKey, nowMs, false);
            return false;
        }
        if (spoken || nowMs - since < dwellMs) return false;
        spoken = true;
        return true;
    }

    public void Reset() => (key, spoken) = (null, false);
}

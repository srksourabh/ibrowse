namespace IBrowse.Core;

public readonly record struct Rect(double Left, double Top, double Width, double Height);

public readonly record struct Viewport(double Width, double Height);

public enum Horizontal { Left, Center, Right }

public enum Vertical { Top, Middle, Bottom }

public readonly record struct ScreenPlace(Horizontal Horizontal, Vertical Vertical);

/// <summary>Where the centre of a rectangle sits on the screen, in thirds, and how to say it.</summary>
public static class Placement
{
    public static ScreenPlace Of(Rect rect, Viewport viewport) =>
        new((Horizontal)Third(rect.Left + rect.Width / 2, viewport.Width),
            (Vertical)Third(rect.Top + rect.Height / 2, viewport.Height));

    public static string Phrase(ScreenPlace place) => (place.Vertical, place.Horizontal) switch
    {
        (Vertical.Top, Horizontal.Left) => "top left",
        (Vertical.Top, Horizontal.Center) => "at the top",
        (Vertical.Top, Horizontal.Right) => "top right",
        (Vertical.Middle, Horizontal.Left) => "on the left",
        (Vertical.Middle, Horizontal.Center) => "in the middle",
        (Vertical.Middle, Horizontal.Right) => "on the right",
        (Vertical.Bottom, Horizontal.Left) => "bottom left",
        (Vertical.Bottom, Horizontal.Center) => "at the bottom",
        _ => "bottom right",
    };

    /// <summary>A zero-size axis counts as the middle.</summary>
    private static int Third(double position, double size)
    {
        if (size <= 0) return 1;
        var ratio = position / size;
        return ratio < 1.0 / 3 ? 0 : ratio > 2.0 / 3 ? 2 : 1;
    }
}

public static class Pan
{
    /// <summary>-1 at the left edge, 1 at the right.</summary>
    public static double FromX(double x, double width) =>
        width <= 0 ? 0 : Math.Clamp(x / width * 2 - 1, -1, 1);
}

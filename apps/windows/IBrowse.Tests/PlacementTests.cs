using IBrowse.Core;

namespace IBrowse.Tests;

public class PlacementTests
{
    private static readonly Viewport Screen = new(900, 900);

    [Theory]
    [InlineData(0, 0, "top left")]
    [InlineData(400, 0, "at the top")]
    [InlineData(800, 0, "top right")]
    [InlineData(0, 400, "on the left")]
    [InlineData(400, 400, "in the middle")]
    [InlineData(800, 400, "on the right")]
    [InlineData(0, 800, "bottom left")]
    [InlineData(400, 800, "at the bottom")]
    [InlineData(800, 800, "bottom right")]
    public void Says_where_a_point_sits(double x, double y, string expected) =>
        Assert.Equal(expected, Placement.Phrase(Placement.Of(new Rect(x, y, 0, 0), Screen)));

    [Fact]
    public void Zero_size_screen_counts_as_the_middle() =>
        Assert.Equal("in the middle", Placement.Phrase(Placement.Of(new Rect(5, 5, 1, 1), new Viewport(0, 0))));

    [Theory]
    [InlineData(0, -1.0)]
    [InlineData(500, 0.0)]
    [InlineData(1000, 1.0)]
    [InlineData(-50, -1.0)]
    [InlineData(2000, 1.0)]
    public void Pan_runs_from_left_to_right(double x, double expected) =>
        Assert.Equal(expected, Pan.FromX(x, 1000), 6);

    [Fact]
    public void Pan_is_centred_without_a_width() => Assert.Equal(0, Pan.FromX(10, 0));
}

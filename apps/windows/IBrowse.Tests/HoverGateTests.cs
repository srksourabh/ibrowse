using IBrowse.Core;

namespace IBrowse.Tests;

public class HoverGateTests
{
    [Fact]
    public void Speaks_after_the_pointer_rests_on_one_element()
    {
        var gate = new HoverGate();
        Assert.False(gate.Update(100, 100, "a", 0));
        Assert.False(gate.Update(100, 100, "a", 149));
        Assert.True(gate.Update(100, 100, "a", 150));
    }

    [Fact]
    public void Speaks_each_element_only_once()
    {
        var gate = new HoverGate();
        gate.Update(0, 0, "a", 0);
        Assert.True(gate.Update(0, 0, "a", 200));
        Assert.False(gate.Update(0, 0, "a", 400));
    }

    [Fact]
    public void Moving_to_another_element_restarts_the_wait()
    {
        var gate = new HoverGate();
        gate.Update(0, 0, "a", 0);
        gate.Update(50, 0, "b", 100);
        Assert.False(gate.Update(50, 0, "b", 200));
        Assert.True(gate.Update(50, 0, "b", 250));
    }

    [Fact]
    public void A_tiny_jitter_does_not_change_the_target()
    {
        var gate = new HoverGate();
        gate.Update(100, 100, "a", 0);
        Assert.False(gate.Update(103, 102, "b", 100));
        Assert.True(gate.Update(103, 102, "b", 150));
    }

    [Fact]
    public void Leaving_and_returning_speaks_again()
    {
        var gate = new HoverGate();
        gate.Update(0, 0, "a", 0);
        gate.Update(0, 0, "a", 200);
        gate.Update(80, 0, "b", 300);
        gate.Update(0, 0, "a", 400);
        Assert.True(gate.Update(0, 0, "a", 550));
    }

    [Fact]
    public void Reset_forgets_everything()
    {
        var gate = new HoverGate();
        gate.Update(0, 0, "a", 0);
        gate.Update(0, 0, "a", 200);
        gate.Reset();
        gate.Update(0, 0, "a", 300);
        Assert.True(gate.Update(0, 0, "a", 450));
    }
}

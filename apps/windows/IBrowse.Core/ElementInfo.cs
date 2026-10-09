namespace IBrowse.Core;

public enum Affordance { Static, Interactive }

/// <summary>Sure when the platform says so; Maybe when clickability is only a guess.</summary>
public enum Certainty { Sure, Maybe }

public enum TriState { Off, On, Mixed }

/// <summary>What the explorer knows about the element under the pointer.</summary>
public sealed record ElementInfo(string Role, string Label, Affordance Affordance, Certainty Certainty)
{
    public bool Disabled { get; init; }
    public int? HeadingLevel { get; init; }
    public TriState? Checked { get; init; }
    public TriState? Pressed { get; init; }
    public bool? Expanded { get; init; }
    public bool? Selected { get; init; }

    /// <summary>A field's value. For a password only "" or "filled", never the text.</summary>
    public string? Value { get; init; }
    public bool Secret { get; init; }
    public bool Required { get; init; }
}

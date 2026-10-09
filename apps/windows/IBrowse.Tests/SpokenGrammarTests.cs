using IBrowse.Core;

namespace IBrowse.Tests;

public class SpokenGrammarTests
{
    private static ElementInfo Interactive(string role, string label, Certainty certainty = Certainty.Sure) =>
        new(role, label, Affordance.Interactive, certainty);

    [Fact]
    public void Button_says_label_role_and_clickable() =>
        Assert.Equal("Save — Button, Clickable", SpokenGrammar.Text(Interactive("button", "Save")));

    [Fact]
    public void Short_mode_drops_clickable() =>
        Assert.Equal("Save — Button", SpokenGrammar.Text(Interactive("button", "Save"), shortMode: true));

    [Fact]
    public void A_guess_says_may_be_clickable() =>
        Assert.Equal("Menu — May be clickable", SpokenGrammar.Text(Interactive("button", "Menu", Certainty.Maybe)));

    [Fact]
    public void Disabled_control_says_disabled_even_in_short_mode()
    {
        var info = Interactive("button", "Pay") with { Disabled = true };
        Assert.Equal("Pay — Button, Disabled", SpokenGrammar.Text(info, shortMode: true));
    }

    [Fact]
    public void Unlabeled_control_says_unlabeled() =>
        Assert.Equal("Unlabeled — Link, Clickable", SpokenGrammar.Text(Interactive("link", "")));

    [Fact]
    public void Unknown_role_is_capitalised() =>
        Assert.Equal("Go — Dial, Clickable", SpokenGrammar.Text(Interactive("dial", "Go")));

    [Fact]
    public void Checkbox_reports_its_state() =>
        Assert.Equal("Agree — Checkbox, checked, Clickable",
            SpokenGrammar.Text(Interactive("checkbox", "Agree") with { Checked = TriState.On }));

    [Fact]
    public void Mixed_checkbox_says_partially_checked() =>
        Assert.Equal("All — Checkbox, partially checked, Clickable",
            SpokenGrammar.Text(Interactive("checkbox", "All") with { Checked = TriState.Mixed }));

    [Fact]
    public void Empty_edit_field_says_empty_and_required()
    {
        var info = Interactive("textbox", "Name") with { Value = "", Required = true };
        Assert.Equal("Name — Edit text, empty, required, Clickable", SpokenGrammar.Text(info));
    }

    [Fact]
    public void Password_never_reveals_its_text()
    {
        var info = Interactive("textbox", "Password") with { Value = "filled", Secret = true };
        var spoken = SpokenGrammar.Text(info);
        Assert.Equal("Password — Password field, filled, Clickable", spoken);
    }

    [Fact]
    public void Plain_text_says_text_only() =>
        Assert.Equal("Welcome — Text only",
            SpokenGrammar.Text(new ElementInfo("text", "Welcome", Affordance.Static, Certainty.Sure)));

    [Fact]
    public void Static_without_a_label_says_text_only() =>
        Assert.Equal("Text only",
            SpokenGrammar.Text(new ElementInfo("text", "", Affordance.Static, Certainty.Sure)));

    [Fact]
    public void Paragraph_offers_the_first_five_words()
    {
        var info = new ElementInfo("paragraph", "The quick brown fox jumps over the lazy dog.", Affordance.Static, Certainty.Sure);
        Assert.Equal("Paragraph: The quick brown fox jumps. Click to read.", SpokenGrammar.Text(info));
    }

    [Fact]
    public void Heading_says_its_level() =>
        Assert.Equal("News — Heading level 2, Text only",
            SpokenGrammar.Text(new ElementInfo("heading", "News", Affordance.Static, Certainty.Sure) { HeadingLevel = 2 }));

    [Fact]
    public void Image_without_a_label_says_no_description() =>
        Assert.Equal("Image, no description",
            SpokenGrammar.Text(new ElementInfo("image", "", Affordance.Static, Certainty.Sure)));

    [Fact]
    public void Labelled_image_says_image() =>
        Assert.Equal("Logo — Image",
            SpokenGrammar.Text(new ElementInfo("image", "Logo", Affordance.Static, Certainty.Sure)));
}

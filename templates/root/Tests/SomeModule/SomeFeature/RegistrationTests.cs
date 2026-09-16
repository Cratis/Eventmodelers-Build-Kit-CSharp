using CratisApp.SomeModule.SomeFeature.Registration;
using Xunit;

namespace CratisApp.SomeModule.SomeFeature;

public class RegistrationTests
{
    [Fact]
    public void Register_should_append_registered_with_the_name()
    {
        var name = new SomeName("Test Registration");

        var (eventSourceId, @event) = new Register(name).Handle();

        Assert.NotEqual(Guid.Empty, eventSourceId.Value);
        Assert.Equal(name, @event.Name);
    }

    [Fact]
    public void Register_should_produce_a_new_event_source_id_each_time()
    {
        var name = new SomeName("Test Registration");

        var (first, _) = new Register(name).Handle();
        var (second, _) = new Register(name).Handle();

        Assert.NotEqual(first, second);
    }
}

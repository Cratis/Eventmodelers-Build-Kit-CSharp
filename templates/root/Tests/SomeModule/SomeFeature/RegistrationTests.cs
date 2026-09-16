using Cratis.Chronicle.Projections;
using Cratis.Chronicle.Testing;
using Cratis.Testing;

namespace CratisApp.SomeModule.SomeFeature;

public class RegistrationTests : SpecificationFor<Registration>
{
    [Fact]
    public void should_be_registered()
    {
        // Arrange
        var register = new Register(Guid.NewGuid(), "Test Registration");

        // Act
        var result = Handle(register);

        // Assert
        result.ShouldNotBeNull();
        result.ShouldBeOfType<Registration>();
    }
}

using CratisApp.SomeModule.SomeFeature.Registration;

namespace CratisApp.SomeModule.SomeFeature.Listing;

[ReadModel]
[FromEvent<Registered>]
public record Listing(
    Guid Id,
    SomeName Name,
    [SetFromContext<Registered>(nameof(EventContext.EventSourceId))] EventSourceId EventSourceId)
{
    public static ISubject<IEnumerable<Listing>> AllListings(IMongoCollection<Listing> collection) =>
        collection.Observe();
}

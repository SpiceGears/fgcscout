FROM mcr.microsoft.com/dotnet/sdk:10.0 AS development
WORKDIR /src

COPY backend.csproj ./
RUN dotnet restore backend.csproj

COPY . ./

EXPOSE 80
CMD ["dotnet", "watch", "run", "--no-launch-profile", "--project", "backend.csproj", "--", "--urls", "http://0.0.0.0:80"]

FROM development AS build
RUN dotnet publish backend.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./

EXPOSE 80
ENTRYPOINT ["dotnet", "FGCScoutAPI.dll"]

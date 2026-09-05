# 1. Stage Runtime (ASP.NET 10 Runtime untuk Blazor Server / WebAssembly Host)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# 2. Stage Build (Gunakan SDK .NET 10)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy file .csproj Blazor
COPY ["blazor/AumoBlazor.csproj", "blazor/"]
RUN dotnet restore "blazor/AumoBlazor.csproj"

# Copy seluruh source code
COPY . .
WORKDIR "/src/blazor"
RUN dotnet publish "AumoBlazor.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 3. Stage Final (Gabungkan hasil publish ke runtime)
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AumoBlazor.dll"]

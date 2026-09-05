# 1. Stage Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# 2. Stage Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy file .csproj dari folder backend/
COPY ["backend/AumoBackend.csproj", "backend/"]
RUN dotnet restore "backend/AumoBackend.csproj"

# Copy seluruh source code
COPY . .
WORKDIR "/src/backend"
RUN dotnet publish "AumoBackend.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 3. Stage Final
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AumoBackend.dll"]

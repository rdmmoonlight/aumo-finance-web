# 1. Stage Runtime (Ukuran image lebih kecil untuk jalanin app)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# 2. Stage Build (Gunakan SDK lengkap untuk compile)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy file .csproj dulu agar restore bisa ditaruh di cache
COPY ["AumoFinance.csproj", "./"]
RUN dotnet restore "AumoFinance.csproj"

# Copy seluruh source code dan publish
COPY . .
RUN dotnet publish "AumoFinance.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 3. Stage Final (Gabungkan hasil build ke runtime)
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AumoFinance.dll"]
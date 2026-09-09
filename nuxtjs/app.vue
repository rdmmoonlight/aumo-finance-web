<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Component Sidebar -->
    <Sidebar />

    <div class="flex flex-col flex-1 overflow-y-auto">
      <!-- Component Topbar -->
      <Topbar />

      <!-- Area konten dinamis halaman (seperti {children} di React) -->
      <main class="p-4">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>
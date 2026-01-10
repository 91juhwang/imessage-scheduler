function getStatusBadgeClass(status: string) {
  switch (status) {
    case "QUEUED":
      return "bg-yellow-100 text-zinc-900";
    case "SENT":
      return "bg-green-300/50 text-black";
    case "DELIVERED":
      return "bg-blue-300/50 text-black";
    case "CANCELED":
      return "bg-red-300/50 text-black";
    default:
      return "bg-zinc-100 text-zinc-900";
  }
}

export { getStatusBadgeClass };

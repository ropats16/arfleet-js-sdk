export const getProgressColorByPlacementStatus = (status: string, assignmentStatus: string) => {
    if (assignmentStatus === 'interrupted') return "bg-gray-400";
    return status === 'completed' ? "bg-green-500" :
           status === 'error' ? "bg-red-400" :
           "bg-yellow-500";
};

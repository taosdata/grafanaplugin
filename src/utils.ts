import axios from 'axios';

export async function deleteAlerts(datasourceName: string): Promise<void> {
    try {
        let folderUid = getFolderUid(datasourceName);
        // 异步操作，例如等待一个异步调用
        await deletGroupAlerts("alert_1m", folderUid);
        await deletGroupAlerts("alert_5m", folderUid);
        await deletGroupAlerts("alert_30s", folderUid);
        await deletGroupAlerts("alert_90s", folderUid);
        await deletGroupAlerts("alert_180s", folderUid);
        await deletGroupAlerts("alert_24h", folderUid);
        await deleteFolder(folderUid);
        await getRules();
    } catch (error) {
        // 处理错误
        console.error('Error in async function:', error);
        throw error;
    }
}

async function deletGroupAlerts(ruleGroup: string, datasourceName: string): Promise<boolean> {
    try{
        let path = `/api/v1/provisioning/folder/${datasourceName}/rule-groups/${ruleGroup}`;
        let response = await axios.delete(path);
        if (!!response && response.status=== 204) {
            return true;
        }
        console.log(response);   
        return false;
    } catch(e) {
        console.log(e);                 
        return false 
    }  
}

async function deleteFolder(folderUid: string): Promise<boolean> {
    
    try {
        let response = await axios.delete(`/api/folders/${folderUid}`);
        if (!!response && response.status=== 200) {
            return true;
        }

        console.log(response);   
        return false;
    } catch(e) {
        console.log(e);                 
        return false 
    }  
}

export function getFolderUid(datasourceUid: string): string {
    return `alert-${datasourceUid}`;
}


export async function getRules(): Promise<void> {
    try {
        let response = await axios.get(`/api/v1/provisioning/alert-rules`);
        if (!!response && response.status=== 200) {
            console.log(response);
        }
        console.log(response);   
    } catch(e) {
        console.log(e);                 
    }  
    
}

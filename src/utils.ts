import axios from 'axios';

export async function deleteAlerts(datasourceName: string): Promise<void> {
    try {
        let folderUid = getFolderUid(datasourceName);
        await deletGroupAlerts("alert_1m", folderUid);
        await deletGroupAlerts("alert_5m", folderUid);
        await deletGroupAlerts("alert_30s", folderUid);
        await deletGroupAlerts("alert_90s", folderUid);
        await deletGroupAlerts("alert_180s", folderUid);
        await deletGroupAlerts("alert_24h", folderUid);
        await deleteFolder(folderUid);
    } catch (error) {
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
        throw e; 
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
        throw e;  
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
        throw e;                  
    }  
    
}

export async function checkGrafanaVersion(): Promise<boolean> {
    try {
        let response = await axios.get("/api/frontend/settings");
        if (!!response && response.status=== 200 && !!response.data && !!response.data.buildInfo.version) {
            const version = '' + response.data.buildInfo.version;
            const versionParts = version.split(".");
            if (versionParts.length > 0) {
                const majorVersion = parseInt(versionParts[0], 10);
                if (majorVersion === 11) {
                    console.log("11 version");
                    return true; 
                }
            }
        }
        return false;
    } catch(e) {
        console.log(e); 
        throw e;                 
    }  
}

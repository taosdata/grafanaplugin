export class GenericDatasourceConfigCtrl {
    /** @ngInject */
    constructor($scope, $injector, $q) {
        this.scope = $scope;
        // console.log($scope, $injector, $q)
        this.backendSrv = $injector.get("backendSrv");
        this.pluginId = this.current.type;
        this.smsShowFlag = false;
        this.requestResources("/getSmsConfig").then(res => {
            console.log(this.current.uid,res);
            if (!!res&&!!res.data&&!!res.data[this.current.uid]) {
                this.current.jsonData.smsConfig = res.data[this.current.uid];
                this.current.jsonData.smsConfig.phoneNumbersList = this.current.jsonData.smsConfig.phoneNumbers?this.current.jsonData.smsConfig.phoneNumbers.join(","):"";
                this.smsShowFlag = this.current.jsonData.smsConfig.phoneNumbersList.length>0||this.current.jsonData.smsConfig.listenAddr.length>0||Object.values(this.current.jsonData.smsConfig.alibabaCloudSms).join("").length>0;
            }else{
                this.current.jsonData.smsConfig = {
                    alibabaCloudSms:{
                        accessKeyId:"",
                        accessKeySecret:"",
                        signName:"",
                        templateCode:"",
                        templateParam:"",
                    },
                    phoneNumbersList:"",
                    phoneNumbers:[],
                    listenAddr:"",
                }
            }
            this.scope.$apply();
        });
        if (!this.current.jsonData.user) {
            this.current.jsonData.user = "root";
        }
        if (!this.current.jsonData.password) {
            this.current.jsonData.password = "taosdata";
        }
    }
    requestResources(url, params) {
        return this.backendSrv.datasourceRequest({
            url: `/api/plugins/${this.pluginId}/resources${url}`,
            data: params,
            method: 'POST',
        });
    }
    smsShowChange() {
        this.smsShowFlag = !this.smsShowFlag;
    }
}

GenericDatasourceConfigCtrl.templateUrl = 'partials/config.html';
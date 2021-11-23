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
                this.current.jsonData.smsConfig.PhoneNumberLists = this.current.jsonData.smsConfig.PhoneNumbers.join(",");
                this.smsShowFlag = true;
                this.scope.$apply();
            }
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
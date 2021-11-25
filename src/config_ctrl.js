export class GenericDatasourceConfigCtrl {
    /** @ngInject */
    constructor($scope, $injector, $q) {
        this.scope = $scope;
        // console.log($scope, $injector, $q)
        this.backendSrv = $injector.get("backendSrv");
        this.pluginId = this.current.type;
        this.smsShowFlag = false;
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